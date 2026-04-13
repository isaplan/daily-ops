/**
 * @registry-id: borkDayBreakdownApi
 * @created: 2026-04-13T00:00:00.000Z
 * @last-modified: 2026-04-13T00:00:00.000Z
 * @description: Get day breakdown data for revenue verification across all dimensions
 * @last-fix: [2026-04-13] Initial creation
 * 
 * @exports-to:
 * ✓ pages/daily-ops/sales/day-breakdown.vue => Fetches breakdown for selected date
 */

import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dateStr = query.date as string
  const location = (query.location as string) || 'all'

  if (!dateStr) {
    throw createError({ statusCode: 400, statusMessage: 'date parameter required (YYYY-MM-DD)' })
  }

  const db = await getDb()

  try {
    // Business day: 08:00 on dateStr to 08:00 on dateStr+1
    const startDate = new Date(`${dateStr}T08:00:00Z`)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 1)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Build query filters
    const dateQuery = { date: { $gte: startDateStr, $lte: endDateStr } }
    const locationQuery = location === 'all' ? {} : { locationName: location }

    // Fetch hourly breakdown
    const hourly = await db
      .collection('bork_sales_by_hour')
      .find({ ...dateQuery, ...locationQuery })
      .sort({ date: 1, hour: 1 })
      .toArray()

    // Fetch worker breakdown
    const worker = await db
      .collection('bork_sales_by_worker')
      .find({ ...dateQuery, ...locationQuery })
      .sort({ total_revenue: -1 })
      .toArray()

    // Fetch table breakdown
    const table = await db
      .collection('bork_sales_by_table')
      .find({ ...dateQuery, ...locationQuery })
      .sort({ total_revenue: -1 })
      .toArray()

    // Fetch product breakdown
    const product = await db
      .collection('bork_products_master')
      .find({ ...dateQuery, ...locationQuery })
      .sort({ total_revenue: -1 })
      .toArray()

    return {
      dateRange: {
        startDate: startDateStr,
        endDate: endDateStr,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      },
      location,
      hourly,
      worker,
      table,
      product,
    }
  } catch (e) {
    console.error('[borkDayBreakdownApi]', e)
    throw createError({ statusCode: 500, statusMessage: String(e) })
  }
})
