/**
 * @registry-id: salesAggregatedApi
 * @created: 2026-04-01T00:00:00.000Z
 * @last-modified: 2026-05-07T12:00:00.000Z
 * @description: Sales aggregates reader — V2 collections only (`*_v2` via resolveBorkAggReadSuffix); product rollups from `bork_sales_by_product`
 * @last-fix: [2026-05-07] Drop V1/bork_raw product path; read `bork_sales_by_product`; align all groupBy with V2 pipeline + business_date
 *
 * @exports-to:
 * ✓ pages/daily-ops/sales/*.vue
 * ✓ composables/useSalesRowProducts.ts (via /api/sales-aggregated-products)
 */
import { getDb } from '../utils/db'
import { ObjectId, type Db } from 'mongodb'
import { amsterdamTodayYmd, amsterdamYmdForOffset } from '~/utils/inbox/importTableQuickDates'
import { resolveBorkAggReadSuffix } from '../utils/borkAggVersionSuffix'

const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 50

function parsePageParams(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const rawSize = parseInt(String(query.pageSize ?? String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

/** Default window: last ~30 Amsterdam days ending yesterday (consistent with V2 API). */
function normalizeV2BusinessDateRange(startDate: string | undefined, endDate: string | undefined) {
  const yesterday = amsterdamYmdForOffset(-1)
  const thirtyBeforeYesterday = amsterdamYmdForOffset(-30)
  if (!startDate && !endDate) return { start: thirtyBeforeYesterday, end: yesterday }
  if (startDate && !endDate) return { start: startDate, end: yesterday }
  if (!startDate && endDate) {
    const e = new Date(`${endDate}T12:00:00Z`)
    const s = new Date(e.getTime() - 29 * 24 * 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const start = `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`
    return { start, end: endDate }
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

async function aggregateLocationFromBusinessDays(
  db: Db,
  collection: string,
  match: Record<string, unknown>,
  sortObj: Record<string, 1 | -1>,
  skip: number,
  pageSize: number
): Promise<{
  results: unknown[]
  totalCount: number
  totals: { total_revenue: number; total_quantity: number; record_count: number }
}> {
  const pipeline: Record<string, unknown>[] = [
    { $match: match },
    {
      $group: {
        _id: { locationId: '$locationId', locationName: '$locationName' },
        total_revenue: { $sum: { $ifNull: ['$total_revenue', 0] } },
        total_quantity: { $sum: { $ifNull: ['$total_quantity', 0] } },
        record_count: { $sum: { $ifNull: ['$record_count', 0] } },
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
        product_count: { $literal: 0 },
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
  const agg = await db.collection(collection).aggregate(pipeline).toArray()
  const facet = agg[0] as { total: { count: number }[]; data: unknown[] } | undefined
  const totals = await sumMatchedMetrics(db, collection, match)
  return {
    results: facet?.data ?? [],
    totalCount: facet?.total[0]?.count ?? 0,
    totals,
  }
}

/**
 * Roll up `bork_sales_by_product` (per business day × location × product × unit price) into
 * one row per product × unit_price with `byLocation` (same shape as legacy raw aggregate).
 */
async function aggregateSalesByProductFromV2Collection(
  db: Db,
  collection: string,
  rangeStart: string,
  rangeEnd: string,
  unifiedLocationId: ObjectId | string | undefined,
  productSearch: string,
  minLineTotal: number,
  sortObj: Record<string, 1 | -1>,
  skip: number,
  pageSize: number
): Promise<{
  results: unknown[]
  totalCount: number
  totals: { total_revenue: number; total_quantity: number; record_count: number }
}> {
  const match: Record<string, unknown> = {
    business_date: { $gte: rangeStart, $lte: rangeEnd },
  }
  if (unifiedLocationId !== undefined) match.locationId = unifiedLocationId

  const escapedSearch = productSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const pipeline: Record<string, unknown>[] = [
    { $match: match },
    {
      $group: {
        _id: {
          productId: '$productId',
          unitPrice: '$unit_price',
          locationId: '$locationId',
          locationName: '$locationName',
        },
        productName: { $first: '$productName' },
        quantity: { $sum: { $ifNull: ['$total_quantity', 0] } },
        lineTotal: { $sum: { $ifNull: ['$total_revenue', 0] } },
      },
    },
    {
      $group: {
        _id: { productKey: '$_id.productId', unitPrice: '$_id.unitPrice' },
        productName: { $first: '$productName' },
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

  const agg = await db.collection(collection).aggregate(pipeline, { allowDiskUse: true }).toArray()
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

function mapSalesRowsForUi(groupBy: string, rows: unknown[]): unknown[] {
  return rows.map((raw) => {
    const r = raw as Record<string, unknown>
    const out: Record<string, unknown> = { ...r }
    if (groupBy === 'hour' || groupBy === 'table' || groupBy === 'worker' || groupBy === 'guestAccount') {
      out.date = r.calendar_date ?? r.date ?? r.business_date
      out.hour = r.calendar_hour ?? r.hour ?? r.business_hour
    }
    if (groupBy === 'date' || groupBy === 'date_location') {
      out.date = r.business_date ?? r.date
      out.location_count = 1
      out.location_name = r.locationName ?? r.location_name
    }
    if (groupBy === 'product') {
      out.product_name = r.productName ?? r.product_name
      const bl = r.byLocation
      out.location_count = Array.isArray(bl) ? bl.length : 0
    }
    return out
  })
}

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const { page, pageSize, skip } = parsePageParams(query as Record<string, unknown>)
    const suffix = resolveBorkAggReadSuffix()

    const rawStart = typeof query.startDate === 'string' ? query.startDate : undefined
    const rawEnd = typeof query.endDate === 'string' ? query.endDate : undefined
    let { start: rangeStart, end: rangeEnd } = normalizeV2BusinessDateRange(rawStart, rawEnd)

    const todayAmsterdam = amsterdamTodayYmd()
    if (rangeEnd >= todayAmsterdam) {
      rangeEnd = amsterdamYmdForOffset(-1)
    }
    if (rangeStart > rangeEnd) {
      rangeStart = amsterdamYmdForOffset(-30)
    }

    const locationId = typeof query.locationId === 'string' ? query.locationId : undefined
    let groupBy = (query.groupBy as string) || 'date'
    if (groupBy === 'day') groupBy = 'date'

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

    const fullDaysOnly = query.fullDaysOnly === 'true' || query.fullDaysOnly === '1'

    const dateFilter: Record<string, unknown> = {
      $gte: rangeStart,
      $lte: rangeEnd,
    }

    const q: Record<string, unknown> = { business_date: dateFilter }
    const locationFilter = parseLocationFilter(locationId)
    if (locationFilter !== undefined) q.locationId = locationFilter

    if ((groupBy === 'date' || groupBy === 'day') && fullDaysOnly) {
      q.hour_buckets = 24
    }

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

    const usesBusinessDate =
      groupBy === 'date' ||
      groupBy === 'date_location' ||
      groupBy === 'hour' ||
      groupBy === 'table' ||
      groupBy === 'worker' ||
      groupBy === 'guestAccount'

    if (resolvedSortKey === 'date' && usesBusinessDate) {
      resolvedSortKey = 'business_date'
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1

    let sortObj: Record<string, 1 | -1>
    if (groupBy === 'hour') {
      if (sortBy === 'hour' || sortBy === 'business_hour') {
        sortObj = { business_date: -1, business_hour: sortDirection }
      } else {
        sortObj = { business_date: sortDirection === 1 ? 1 : -1, business_hour: 1 }
      }
    } else if (groupBy === 'product') {
      const sk =
        sortBy === 'product_name'
          ? 'productName'
          : sortBy === 'unit_price'
            ? 'unit_price'
            : sortBy === 'total_quantity'
              ? 'total_quantity'
              : 'total_revenue'
      sortObj = { [sk]: sortDirection }
    } else {
      const sf =
        resolvedSortKey === 'date'
          ? 'business_date'
          : resolvedSortKey === 'location_name'
            ? 'location_name'
            : resolvedSortKey === 'product_name'
              ? 'product_name'
              : resolvedSortKey
      sortObj = { [sf]: sortDirection }
    }

    let results: unknown[] = []
    let collectionName = `bork_business_days${suffix}`
    let totalCount = 0
    let totals = { total_revenue: 0, total_quantity: 0, record_count: 0 }
    const excludeProducts = !includeProducts

    if (groupBy === 'date') {
      collectionName = `bork_business_days${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, false)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'location') {
      collectionName = `bork_business_days${suffix}`
      const out = await aggregateLocationFromBusinessDays(db, collectionName, q, sortObj, skip, pageSize)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'product') {
      collectionName = `bork_sales_by_product${suffix}`
      const out = await aggregateSalesByProductFromV2Collection(
        db,
        collectionName,
        rangeStart,
        rangeEnd,
        locationFilter,
        productSearch,
        minRevenue,
        sortObj,
        skip,
        pageSize
      )
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'date_location') {
      collectionName = `bork_business_days${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, false)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'hour') {
      collectionName = `bork_sales_by_hour${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'table') {
      collectionName = `bork_sales_by_table${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'worker') {
      collectionName = `bork_sales_by_worker${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'guestAccount') {
      collectionName = `bork_sales_by_guest_account${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else {
      collectionName = `bork_business_days${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, false)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    }

    results = mapSalesRowsForUi(groupBy, results)

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
        v2_suffix: suffix || null,
      },
      locations,
    }
  } catch (error) {
    console.error('[sales-aggregated]', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch sales data' })
  }
})
