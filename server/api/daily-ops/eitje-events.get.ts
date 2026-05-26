/**
 * Aggregated Eitje events by day/location/kind/title.
 *
 * @registry-id: dailyOpsEitjeEventsAPI
 * @created: 2026-05-25T22:25:00.000Z
 * @last-modified: 2026-05-25T22:25:00.000Z
 * @description: GET /api/daily-ops/eitje-events reads eitje_events_aggregation
 * @last-fix: [2026-05-25] Added read API for aggregated Eitje events.
 *
 * @exports-to:
 * ✓ Future Daily Ops planning views
 */
import { getDb } from '../../utils/db'

type EventRow = {
  period: string
  locationId: string
  location_name: string
  kind: string
  title: string
  event_count: number
  from?: string
  till?: string
  remarks?: string
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
  const collection = db.collection<EventRow>('eitje_events_aggregation')
  const [rows, totals] = await Promise.all([
    collection
      .find(match, { projection: { _id: 0 } })
      .sort({ period: 1, location_name: 1, kind: 1, title: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection
      .aggregate<{ total_events: number; row_count: number }>([
        { $match: match },
        {
          $group: {
            _id: null,
            total_events: { $sum: '$event_count' },
            row_count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, total_events: 1, row_count: 1 } },
      ])
      .next(),
  ])

  return {
    success: true,
    range: { startDate, endDate, locationId },
    totals: totals ?? { total_events: 0, row_count: 0 },
    data: rows,
  }
})
