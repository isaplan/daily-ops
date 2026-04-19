import { getDb } from '../utils/db'
import { ObjectId, type Db } from 'mongodb'

const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 50

function parsePageParams(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const rawSize = parseInt(String(query.pageSize ?? String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

function normalizeDateRange(startDate: string | undefined, endDate: string | undefined) {
  const todayStr = new Date().toISOString().split('T')[0]
  const thirtyBack = new Date()
  thirtyBack.setDate(thirtyBack.getDate() - 30)
  const thirtyStr = thirtyBack.toISOString().split('T')[0]
  if (!startDate && !endDate) return { start: thirtyStr, end: todayStr }
  if (startDate && !endDate) return { start: startDate, end: todayStr }
  if (!startDate && endDate) {
    const e = new Date(endDate)
    const s = new Date(e)
    s.setDate(s.getDate() - 30)
    return { start: s.toISOString().split('T')[0], end: endDate }
  }
  return { start: startDate!, end: endDate! }
}

function parseLocationFilter(locationId: string | undefined): ObjectId | string | undefined {
  if (!locationId || locationId === 'all') return undefined
  try {
    return new ObjectId(locationId)
  } catch {
    return locationId
  }
}

function isoDateToBorkYmdInt(iso: string): number {
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10))
  return y * 10000 + m * 100 + d
}

/**
 * Sales by product + exact Bork line Price, from bork_raw_data only (no menu, no averages).
 * One row per (ProductKey, unit Price); quantities and line totals summed; byLocation breaks down per unified location.
 */
async function aggregateSalesByProductFromRaw(
  db: Db,
  rangeStartIso: string,
  rangeEndIso: string,
  unifiedLocationId: ObjectId | string | undefined,
  productSearch: string,
  minLineTotal: number,
  sortObj: Record<string, 1 | -1>,
  skip: number,
  pageSize: number,
): Promise<{
  results: unknown[]
  totalCount: number
  totals: { total_revenue: number; total_quantity: number; record_count: number }
}> {
  const startYmd = isoDateToBorkYmdInt(rangeStartIso)
  const endYmd = isoDateToBorkYmdInt(rangeEndIso)

  const rawMatch: Record<string, unknown> = { rawApiResponse: { $exists: true, $ne: null } }

  if (unifiedLocationId !== undefined) {
    const maps = await db
      .collection('bork_unified_location_mapping')
      .find({ unifiedLocationId })
      .project({ borkLocationId: 1 })
      .toArray()
    const borkIds = maps.map((m) => m.borkLocationId).filter((id) => id != null)
    if (borkIds.length === 0) {
      return { results: [], totalCount: 0, totals: { total_revenue: 0, total_quantity: 0, record_count: 0 } }
    }
    rawMatch.locationId = { $in: borkIds }
  }

  const escapedSearch = productSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const pipeline: Record<string, unknown>[] = [
    { $match: rawMatch },
    {
      $addFields: {
        _tickets: {
          $cond: {
            if: { $isArray: '$rawApiResponse' },
            then: '$rawApiResponse',
            else: {
              $cond: {
                if: { $ne: ['$rawApiResponse', null] },
                then: ['$rawApiResponse'],
                else: [],
              },
            },
          },
        },
      },
    },
    { $unwind: { path: '$_tickets', preserveNullAndEmptyArrays: false } },
    { $unwind: { path: '$_tickets.Orders', preserveNullAndEmptyArrays: false } },
    {
      $addFields: {
        _ord: '$_tickets.Orders',
        borkLocationId: '$locationId',
      },
    },
    {
      $addFields: {
        odRaw: { $ifNull: ['$_ord.Date', '$_ord.ActualDate'] },
      },
    },
    {
      $addFields: {
        orderYmd: {
          $convert: {
            input: {
              $substrCP: [
                { $concat: ['00000000', { $toString: { $ifNull: ['$odRaw', ''] } }] },
                {
                  $subtract: [
                    { $strLenCP: { $concat: ['00000000', { $toString: { $ifNull: ['$odRaw', ''] } }] } },
                    8,
                  ],
                },
                8,
              ],
            },
            to: 'int',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { orderYmd: { $gte: startYmd, $lte: endYmd } } },
    { $unwind: { path: '$_ord.Lines', preserveNullAndEmptyArrays: false } },
    {
      $addFields: {
        line: '$_ord.Lines',
        lineUnitPrice: { $toDouble: { $ifNull: ['$_ord.Lines.Price', 0] } },
        lineQty: { $toDouble: { $ifNull: ['$_ord.Lines.Qty', 0] } },
        productKey: { $toString: { $ifNull: ['$_ord.Lines.ProductKey', 'unknown'] } },
        productName: { $ifNull: ['$_ord.Lines.ProductName', 'Unknown'] },
      },
    },
    {
      $addFields: {
        lineValue: { $multiply: ['$lineUnitPrice', '$lineQty'] },
      },
    },
    {
      $lookup: {
        from: 'bork_unified_location_mapping',
        let: { bid: '$borkLocationId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: [{ $toString: '$borkLocationId' }, { $toString: '$$bid' }] },
            },
          },
          { $limit: 1 },
        ],
        as: '_loc',
      },
    },
    { $match: { '_loc.0': { $exists: true } } },
    {
      $addFields: {
        unifiedLocationId: { $arrayElemAt: ['$_loc.unifiedLocationId', 0] },
        unifiedLocationName: { $arrayElemAt: ['$_loc.unifiedLocationName', 0] },
      },
    },
    {
      $group: {
        _id: {
          productKey: '$productKey',
          productName: '$productName',
          unitPrice: '$lineUnitPrice',
          locationId: '$unifiedLocationId',
          locationName: '$unifiedLocationName',
        },
        quantity: { $sum: '$lineQty' },
        lineTotal: { $sum: '$lineValue' },
      },
    },
    {
      $group: {
        _id: {
          productKey: '$_id.productKey',
          unitPrice: '$_id.unitPrice',
        },
        productName: { $first: '$_id.productName' },
        unit_price: { $first: '$_id.unitPrice' },
        total_quantity: { $sum: '$quantity' },
        total_revenue: { $sum: '$lineTotal' },
        byLocation: {
          $push: {
            locationId: '$_id.locationId',
            locationName: '$_id.locationName',
            quantity: '$quantity',
            lineTotal: '$lineTotal',
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        productId: '$_id.productKey',
        productName: 1,
        unit_price: 1,
        total_quantity: 1,
        total_revenue: 1,
        byLocation: 1,
      },
    },
  ]

  if (productSearch) {
    pipeline.push({ $match: { productName: { $regex: escapedSearch, $options: 'i' } } })
  }
  if (minLineTotal > 0) {
    pipeline.push({ $match: { total_revenue: { $gte: minLineTotal } } })
  }

  pipeline.push({ $sort: sortObj })
  pipeline.push({
    $facet: {
      totals: [
        {
          $group: {
            _id: null,
            total_revenue: { $sum: '$total_revenue' },
            total_quantity: { $sum: '$total_quantity' },
          },
        },
      ],
      totalCount: [{ $count: 'count' }],
      data: [{ $skip: skip }, { $limit: pageSize }],
    },
  })

  const agg = await db.collection('bork_raw_data').aggregate(pipeline, { allowDiskUse: true }).toArray()
  const facet = agg[0] as
    | {
        totals: { total_revenue?: number; total_quantity?: number }[]
        totalCount: { count: number }[]
        data: unknown[]
      }
    | undefined

  const t = facet?.totals[0]
  return {
    results: facet?.data ?? [],
    totalCount: facet?.totalCount[0]?.count ?? 0,
    totals: {
      total_revenue: t?.total_revenue ?? 0,
      total_quantity: t?.total_quantity ?? 0,
      record_count: facet?.totalCount[0]?.count ?? 0,
    },
  }
}

async function sumMatchedMetrics(
  db: Db,
  collection: string,
  match: Record<string, unknown>
): Promise<{ total_revenue: number; total_quantity: number; record_count: number }> {
  const [row] = await db
    .collection(collection)
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: { $ifNull: ['$total_revenue', 0] } },
          total_quantity: { $sum: { $ifNull: ['$total_quantity', 0] } },
          record_count: { $sum: { $ifNull: ['$record_count', 0] } },
        },
      },
    ])
    .toArray()
  const r = row as { total_revenue?: number; total_quantity?: number; record_count?: number } | undefined
  return {
    total_revenue: r?.total_revenue ?? 0,
    total_quantity: r?.total_quantity ?? 0,
    record_count: r?.record_count ?? 0,
  }
}

async function findPaged(
  db: Db,
  collection: string,
  match: Record<string, unknown>,
  sortObj: Record<string, 1 | -1>,
  skip: number,
  limit: number,
  excludeProducts: boolean
): Promise<{
  results: unknown[]
  totalCount: number
  totals: { total_revenue: number; total_quantity: number; record_count: number }
}> {
  const projection = excludeProducts ? { products: 0 } : {}
  const col = db.collection(collection)
  const [results, totalCount, totals] = await Promise.all([
    col.find(match, { projection }).sort(sortObj).skip(skip).limit(limit).toArray(),
    col.countDocuments(match),
    sumMatchedMetrics(db, collection, match),
  ])
  return { results, totalCount, totals }
}

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const { page, pageSize, skip } = parsePageParams(query as Record<string, unknown>)

    const rawStart = typeof query.startDate === 'string' ? query.startDate : undefined
    const rawEnd = typeof query.endDate === 'string' ? query.endDate : undefined
    const { start: rangeStart, end: rangeEnd } = normalizeDateRange(rawStart, rawEnd)

    const locationId = typeof query.locationId === 'string' ? query.locationId : undefined
    const groupBy = (query.groupBy as string) || 'date'
    const sortBy = (query.sortBy as string) || 'date'
    const sortOrder = (query.sortOrder as string) || 'desc'
    const includeProducts =
      query.includeProducts === 'true' || query.includeProducts === '1'
    const includeLocations = query.includeLocations !== 'false' && query.includeLocations !== '0'
    const productSearch = typeof query.productSearch === 'string' ? query.productSearch.trim() : ''
    const minRevenueRaw = query.minRevenue
    const minRevenue =
      typeof minRevenueRaw === 'string' || typeof minRevenueRaw === 'number'
        ? Math.max(0, Number(minRevenueRaw) || 0)
        : 0

    const dateFilter: Record<string, unknown> = {
      $gte: rangeStart,
      $lte: rangeEnd,
    }

    const q: Record<string, unknown> = { date: dateFilter }
    const locationFilter = parseLocationFilter(locationId)
    if (locationFilter !== undefined) q.locationId = locationFilter

    const sortField =
      sortBy === 'location' || sortBy === 'location_name'
        ? 'locationName'
        : sortBy === 'product_name'
          ? 'product_name'
          : sortBy === 'unit_price'
            ? 'unit_price'
            : sortBy === 'total_revenue'
              ? 'total_revenue'
              : sortBy === 'total_quantity'
                ? 'total_quantity'
                : 'date'

    let resolvedSortKey = sortField
    if (groupBy === 'location' && (sortBy === 'location' || sortBy === 'location_name')) {
      resolvedSortKey = 'location_name'
    } else if (groupBy === 'product' && sortBy === 'product_name') {
      resolvedSortKey = 'productName'
    } else if (groupBy === 'product' && sortBy === 'unit_price') {
      resolvedSortKey = 'unit_price'
    }
    if (groupBy === 'product' && resolvedSortKey === 'date') {
      resolvedSortKey = 'total_revenue'
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1
    const sortObj: Record<string, 1 | -1> = { [resolvedSortKey]: sortDirection }

    let results: unknown[] = []
    let collectionName = 'bork_sales_by_cron'
    let totalCount = 0
    let totals = { total_revenue: 0, total_quantity: 0, record_count: 0 }

    const excludeProducts = !includeProducts

    if (groupBy === 'date') {
      collectionName = 'bork_sales_by_cron'
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, false)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'location') {
      collectionName = 'bork_sales_by_cron'
      const pipeline: Record<string, unknown>[] = [
        { $match: q },
        {
          $group: {
            _id: { locationId: '$locationId', locationName: '$locationName' },
            total_revenue: { $sum: '$total_revenue' },
            total_quantity: { $sum: '$total_quantity' },
            record_count: { $sum: '$record_count' },
          },
        },
        {
          $project: {
            _id: 0,
            locationId: '$_id.locationId',
            location_name: '$_id.locationName',
            total_revenue: { $round: ['$total_revenue', 2] },
            total_quantity: { $round: ['$total_quantity', 2] },
            record_count: 1,
          },
        },
        { $sort: sortObj },
        {
          $facet: {
            total: [{ $count: 'count' }],
            data: [{ $skip: skip }, { $limit: pageSize }],
          },
        },
      ]
      const agg = await db.collection(collectionName).aggregate(pipeline).toArray()
      const facet = agg[0] as { total: { count: number }[]; data: unknown[] } | undefined
      totalCount = facet?.total[0]?.count ?? 0
      results = facet?.data ?? []
      totals = await sumMatchedMetrics(db, collectionName, q)
    } else if (groupBy === 'product') {
      collectionName = 'bork_raw_data'
      const out = await aggregateSalesByProductFromRaw(
        db,
        rangeStart,
        rangeEnd,
        locationFilter,
        productSearch,
        minRevenue,
        sortObj,
        skip,
        pageSize,
      )
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (
      groupBy === 'guestAccount' ||
      groupBy === 'hour' ||
      groupBy === 'table' ||
      groupBy === 'worker' ||
      groupBy === 'date_location'
    ) {
      if (groupBy === 'table') collectionName = 'bork_sales_by_table'
      else if (groupBy === 'worker') collectionName = 'bork_sales_by_worker'
      else if (groupBy === 'guestAccount') collectionName = 'bork_sales_by_guest_account'
      else collectionName = 'bork_sales_by_hour'

      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else {
      collectionName = 'bork_sales_by_hour'
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    }

    let locations: { _id: string; name: string }[] = []
    if (includeLocations && groupBy !== 'location') {
      const locs = await db
        .collection('locations')
        .find({}, { projection: { name: 1 } })
        .sort({ name: 1 })
        .toArray()
      locations = locs.map((l) => ({
        _id: String(l._id),
        name: typeof l.name === 'string' ? l.name : '',
      }))
    }

    return {
      success: true,
      data: results,
      pagination: {
        page,
        pageSize,
        totalCount,
      },
      totals,
      summary: {
        group_by: groupBy,
        collection: collectionName,
      },
      locations,
    }
  } catch (error) {
    console.error('[sales-aggregated]', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch sales data' })
  }
})
