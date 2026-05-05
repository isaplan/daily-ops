/**
 * GET /api/bork/sales — Fetch daily sales reports (basis_reports)
 * Filters: date, location, limit
 */

import type { BasisReportData } from '../../utils/inbox/basis-report-mapper'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const date = query.date as string | undefined
    const location = query.location as string | undefined
    const limit = Math.min(parseInt(query.limit as string) || 30, 365)

    const db = await (await import('~/server/utils/inbox/collections').then(m => m.getDb))()
    const collection = db.collection('basis_reports')

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
