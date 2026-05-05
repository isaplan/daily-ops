/**
 * GET /api/bork/sales — Fetch daily basis reports from inbox-bork-basis-report
 * Filters: date, location, limit
 */

import type { BasisReportData } from '../../utils/inbox/basis-report-mapper'
import { getDb } from '../../utils/db'

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
      .sort({ date: -1 })
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
