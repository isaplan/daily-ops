/**
 * @registry-id: borkDayBreakdownV2Api
 * @created: 2026-04-28T00:00:00.000Z
 * @last-modified: 2026-04-30T12:00:00.000Z
 * @description: V2 day breakdown using version-suffixed V2 aggregates
 * @last-fix: [2026-04-30] V2 day-breakdown page removed; API retained
 *
 * @exports-to:
 * (no in-repo UI — call `/api/bork/v2/day-breakdown-v2` from tools or future pages)
 */
import { getDb } from '../../../utils/db'
import { resolveBorkAggReadSuffix } from '../../../utils/borkAggVersionSuffix'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dateStr = query.date as string
  const location = (query.location as string) || 'all'
  const suffix = resolveBorkAggReadSuffix()

  if (!dateStr) {
    throw createError({ statusCode: 400, statusMessage: 'date parameter required (YYYY-MM-DD)' })
  }

  const db = await getDb()
  const hourlyCollection = `bork_sales_by_hour${suffix}`
  const workerCollection = `bork_sales_by_worker${suffix}`
  const tableCollection = `bork_sales_by_table${suffix}`

  try {
    const baseQuery: Record<string, unknown> = { business_date: dateStr }
    if (location !== 'all') baseQuery.locationName = location

    const [hourly, worker, table, product] = await Promise.all([
      db
        .collection(hourlyCollection)
        .find(baseQuery)
        .sort({ business_hour: 1 })
        .toArray(),
      db
        .collection(workerCollection)
        .find(baseQuery)
        .sort({ total_revenue: -1 })
        .toArray(),
      db
        .collection(tableCollection)
        .find(baseQuery)
        .sort({ total_revenue: -1 })
        .toArray(),
      db
        .collection(tableCollection)
        .aggregate([
          { $match: baseQuery },
          { $unwind: { path: '$products', preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: {
                productId: '$products.productId',
                productName: '$products.productName',
              },
              total_revenue: { $sum: { $ifNull: ['$products.revenue', 0] } },
              total_quantity: { $sum: { $ifNull: ['$products.quantity', 0] } },
            },
          },
          {
            $project: {
              _id: 0,
              productId: '$_id.productId',
              productName: '$_id.productName',
              total_revenue: 1,
              total_quantity: 1,
            },
          },
          { $sort: { total_revenue: -1 } },
        ])
        .toArray(),
    ])

    return {
      businessDate: dateStr,
      location,
      collectionSuffix: suffix || null,
      collections: {
        hourly: hourlyCollection,
        worker: workerCollection,
        table: tableCollection,
        product: tableCollection,
      },
      hourly,
      worker,
      table,
      product,
    }
  } catch (e) {
    console.error('[borkDayBreakdownV2Api]', e)
    throw createError({ statusCode: 500, statusMessage: String(e) })
  }
})
