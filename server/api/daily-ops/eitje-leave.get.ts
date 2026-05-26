/**
 * Aggregated Eitje leave requests by day/location/user.
 *
 * @registry-id: dailyOpsEitjeLeaveAPI
 * @created: 2026-05-25T22:25:00.000Z
 * @last-modified: 2026-05-25T22:25:00.000Z
 * @description: GET /api/daily-ops/eitje-leave reads eitje_leave_requests_aggregation
 * @last-fix: [2026-05-25] Added read API for aggregated Eitje leave requests.
 *
 * @exports-to:
 * ✓ Future Daily Ops planning views
 */
import { getDb } from '../../utils/db'

type LeaveRow = {
  period: string
  locationId: string
  location_name: string
  userId: string
  user_name: string
  status: string
  reason: string
  process_reason: string
  request_count: number
  total_leave_hours: number
  earliest_start?: Date
  latest_end?: Date
}

function isoDay (value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const startDate = isoDay(query.startDate) ?? isoDay(query.date)
  const endDate = isoDay(query.endDate) ?? startDate
  if (!startDate || !endDate) {
    throw createError({ statusCode: 400, statusMessage: 'startDate/endDate are required as YYYY-MM-DD' })
  }

  const locationId = typeof query.locationId === 'string' && query.locationId !== 'all'
    ? query.locationId
    : null
  const limit = Math.min(Math.max(Number(query.limit ?? 500), 1), 2000)
  const skip = Math.max(Number(query.skip ?? 0), 0)

  const match: Record<string, unknown> = {
    period_type: 'day',
    period: { $gte: startDate, $lte: endDate },
  }
  if (locationId) match.locationId = locationId

  const db = await getDb()
  const collection = db.collection<LeaveRow>('eitje_leave_requests_aggregation')
  const [rows, totals] = await Promise.all([
    collection
      .find(match, { projection: { _id: 0 } })
      .sort({ period: 1, location_name: 1, user_name: 1, status: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection
      .aggregate<{ total_requests: number; total_leave_hours: number; row_count: number }>([
        { $match: match },
        {
          $group: {
            _id: null,
            total_requests: { $sum: '$request_count' },
            total_leave_hours: { $sum: '$total_leave_hours' },
            row_count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, total_requests: 1, total_leave_hours: 1, row_count: 1 } },
      ])
      .next(),
  ])

  return {
    success: true,
    range: { startDate, endDate, locationId },
    totals: totals ?? { total_requests: 0, total_leave_hours: 0, row_count: 0 },
    data: rows,
  }
})
