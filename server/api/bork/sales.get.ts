/**
 * GET /api/bork/sales — Fetch daily basis reports from inbox-bork-basis-report
 * Filters: date, location, limit
 *
 * Default sort: newest first — business `date` desc, then later-in-day via `business_hour`
 * and batch `cron_hour`, then `received_at` as tie-breaker.
 */

import type { BasisReportData } from '../../utils/inbox/basis-report-mapper'
import { getDb } from '../../utils/db'

/** Order reports from most recent business moment to oldest (within-day: higher hour first). */
const SALES_LIST_SORT: Record<string, 1 | -1> = {
  date: -1,
  business_hour: -1,
  cron_hour: -1,
  received_at: -1,
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const date = query.date as string | undefined
    const location = query.location as string | undefined
    const limit = Math.min(parseInt(query.limit as string) || 30, 365)
    const db = await getDb()
    const collection = db.collection('inbox-bork-basis-report')

    const filter: Record<string, unknown> = {}
    if (date) filter.date = date
    if (location) filter.location = { $regex: location, $options: 'i' }

    const reports = await collection
      .find(filter)
      .sort(SALES_LIST_SORT)
      .limit(limit)
      .toArray()

    return {
      success: true,
      data: reports as BasisReportData[],
      count: reports.length,
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to fetch sales reports',
    })
  }
})
