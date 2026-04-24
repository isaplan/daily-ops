import { getDb } from '../utils/db'
import { ObjectId, type Db } from 'mongodb'
import { amsterdamTodayYmd, amsterdamYmdForOffset } from '~/utils/inbox/importTableQuickDates'

const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 50

function borkV2Suffix(): string {
  return process.env.BORK_AGG_V2_SUFFIX ?? ''
}

function parsePageParams(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const rawSize = parseInt(String(query.pageSize ?? String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

/** Default window: last ~30 Amsterdam days ending yesterday (no partial “today” in V2). */
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

export default defineEventHandler(async (event) => {
  try {
    const db = await getDb()
    const query = getQuery(event)
    const { page, pageSize, skip } = parsePageParams(query as Record<string, unknown>)
    const suffix = borkV2Suffix()

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
    const groupBy = (query.groupBy as string) || 'day'
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

    const fullDaysOnly = query.fullDaysOnly !== 'false' && query.fullDaysOnly !== '0'

    const dateFilter: Record<string, unknown> = {
      $gte: rangeStart,
      $lte: rangeEnd,
    }

    const q: Record<string, unknown> = { business_date: dateFilter }
    const locationFilter = parseLocationFilter(locationId)
    if (locationFilter !== undefined) q.locationId = locationFilter

    if (groupBy === 'day' && fullDaysOnly) {
      q.hour_buckets = 24
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
      const sortField =
        sortBy === 'location' || sortBy === 'location_name'
          ? 'locationName'
          : sortBy === 'total_revenue'
            ? 'total_revenue'
            : sortBy === 'total_quantity'
              ? 'total_quantity'
              : 'business_date'
      sortObj = { [sortField]: sortDirection }
    }

    let results: unknown[] = []
    let collectionName = `bork_business_days${suffix}`
    let totalCount = 0
    let totals = { total_revenue: 0, total_quantity: 0, record_count: 0 }
    const excludeProducts = !includeProducts

    if (groupBy === 'day') {
      collectionName = `bork_business_days${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, true)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'hour') {
      collectionName = `bork_sales_hours${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'table') {
      collectionName = `bork_sales_tables${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'worker') {
      collectionName = `bork_sales_workers${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'guestAccount') {
      collectionName = `bork_sales_guest_accounts${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, excludeProducts)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else if (groupBy === 'product') {
      collectionName = `bork_sales_products${suffix}`
      const pq: Record<string, unknown> = { ...q }
      if (productSearch) {
        pq.productName = { $regex: productSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      }
      if (minRevenue > 0) {
        pq.total_revenue = { $gte: minRevenue }
      }
      const out = await findPaged(db, collectionName, pq, sortObj, skip, pageSize, true)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    } else {
      collectionName = `bork_business_days${suffix}`
      const out = await findPaged(db, collectionName, q, sortObj, skip, pageSize, true)
      results = out.results
      totalCount = out.totalCount
      totals = out.totals
    }

    let locations: { _id: string; name: string }[] = []
    if (includeLocations) {
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
    console.error('[sales-aggregated-v2]', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch V2 sales data' })
  }
})
