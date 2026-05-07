/**
 * @registry-id: eitjeRebuildAggregationService
 * @created: 2026-04-05T12:00:00.000Z
 * @last-modified: 2026-04-26T19:45:00.000Z
 * @description: Rebuilds eitje_time_registration_aggregation day rows from eitje_raw_data for a date range
 * @last-fix: [2026-04-26] Apply business day logic (06:00-05:59:59) to aggregation period + hour fields
 *
 * @exports-to:
 * ✓ server/services/eitjeSyncService.ts
 * ✓ server/api/eitje/v2/sync.post.ts (optional future)
 */

import type { Db } from 'mongodb'
import { EITJE_HOURS_ADD_FIELDS } from '../utils/eitjeHours'

/**
 * Convert UTC calendar date + hour to business day period.
 * Business day: 06:00-05:59:59 next morning.
 * business_hour: 0 = 06:00-06:59, 18 = 00:00-00:59 next day, 23 = 05:00-05:59 next day.
 */
function calendarToBusinessDay(
  calendarDateStr: string,
  calendarHour: number
): { businessDate: string; businessHour: number } {
  if (calendarHour >= 6 && calendarHour <= 23) {
    return { businessDate: calendarDateStr, businessHour: calendarHour - 6 }
  }
  const [y, m, d] = calendarDateStr.split('-').map(Number)
  const prevDate = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) - 1))
  const yy = prevDate.getUTCFullYear()
  const mm = String(prevDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(prevDate.getUTCDate()).padStart(2, '0')
  const prevDateStr = `${yy}-${mm}-${dd}`
  return { businessDate: prevDateStr, businessHour: calendarHour + 18 }
}

export type RebuildAggResult = {
  deletedPeriods: number
  inserted: number
}

function dayStartUtc (dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEndUtc (dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

/**
 * Deletes existing day aggregation in [startDate, endDate] and rebuilds from raw time_registration_shifts.
 */
export async function rebuildEitjeTimeRegistrationAggregation (
  db: Db,
  startDate: string,
  endDate: string
): Promise<RebuildAggResult> {
  const collAgg = db.collection('eitje_time_registration_aggregation')
  const del = await collAgg.deleteMany({
    period_type: 'day',
    period: { $gte: startDate, $lte: endDate },
  })

  const startD = dayStartUtc(startDate)
  const endD = dayEndUtc(endDate)

  const pipeline: unknown[] = [
    {
      $match: {
        endpoint: 'time_registration_shifts',
        date: { $gte: startD, $lte: endD },
      },
    },
    {
      $addFields: {
        ...EITJE_HOURS_ADD_FIELDS,
        calendarDate: {
          $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' },
        },
        calendarHour: {
          $hour: { date: '$date', timezone: 'UTC' },
        },
        userId: { $ifNull: ['$extracted.userId', '$rawApiResponse.user_id'] },
        teamId: { $ifNull: ['$extracted.teamId', '$rawApiResponse.team_id'] },
        environmentId: {
          $ifNull: [
            '$environmentId',
            '$extracted.environmentId',
            '$rawApiResponse.environment_id',
            '$rawApiResponse.environmentId',
            '$rawApiResponse.environment.id',
          ],
        },
      },
    },
    {
      $addFields: {
        period: {
          $cond: [
            { $and: [{ $gte: ['$calendarHour', 6] }, { $lte: ['$calendarHour', 23] }] },
            '$calendarDate',
            {
              $dateToString: {
                format: '%Y-%m-%d',
                date: {
                  $subtract: [{ $toDate: '$calendarDate' }, 86400000]
                },
                timezone: 'UTC',
              },
            },
          ],
        },
        business_hour: {
          $cond: [
            { $and: [{ $gte: ['$calendarHour', 6] }, { $lte: ['$calendarHour', 23] }] },
            { $subtract: ['$calendarHour', 6] },
            { $add: ['$calendarHour', 18] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'unified_location',
        let: { eid: '$environmentId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ['$$eid', null] },
                  { $in: ['$$eid', { $ifNull: ['$eitjeIds', []] }] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { primaryId: 1, primaryName: 1 } },
        ],
        as: 'loc',
      },
    },
    {
      $addFields: {
        locationId: {
          $ifNull: [
            { $arrayElemAt: ['$loc.primaryId', 0] },
            { $toString: { $ifNull: ['$environmentId', 'unknown'] } },
          ],
        },
        location_name: {
          $ifNull: [
            { $arrayElemAt: ['$loc.primaryName', 0] },
            {
              $ifNull: [
                '$extracted.locationName',
                { $ifNull: ['$rawApiResponse.location_name', '$rawApiResponse.environment_name'] },
                { $ifNull: ['$rawApiResponse.environment.name', null] },
              ],
            },
          ],
        },
      },
    },
    {
      $match: {
        userId: { $nin: [null, ''] },
        teamId: { $nin: [null, ''] },
      },
    },
    {
      $lookup: {
        from: 'members',
        let: { uid: '$userId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$eitje_id', '$$uid'] },
                  { $in: ['$$uid', { $ifNull: ['$eitje_ids', []] }] }
                ]
              },
            },
          },
          { $limit: 1 },
          { $project: { hourly_rate: 1 } },
        ],
        as: 'memberDoc',
      },
    },
    {
      $lookup: {
        from: 'unified_user',
        let: { uid: '$userId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $in: ['$$uid', { $ifNull: ['$eitjeIds', []] }] },
                  { $in: ['$$uid', { $ifNull: ['$allIdValues', []] }] },
                  { $eq: ['$primaryId', '$$uid'] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { primaryName: 1, hourly_rate: 1 } },
        ],
        as: 'u',
      },
    },
    {
      $lookup: {
        from: 'unified_team',
        let: { tid: '$teamId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $in: ['$$tid', { $ifNull: ['$eitjeIds', []] }] },
                  { $in: ['$$tid', { $ifNull: ['$allIdValues', []] }] },
                  { $eq: ['$primaryId', '$$tid'] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { primaryName: 1, canonicalName: 1 } },
        ],
        as: 't',
      },
    },
    {
      $addFields: {
        user_name: {
          $ifNull: [
            { $arrayElemAt: ['$u.primaryName', 0] },
            {
              $ifNull: [
                '$rawApiResponse.user.name',
                { $ifNull: ['$rawApiResponse.employee_name', 'Unknown'] },
              ],
            },
          ],
        },
        hourly_rate: {
          $ifNull: [
            { $arrayElemAt: ['$memberDoc.hourly_rate', 0] },
            { $arrayElemAt: ['$u.hourly_rate', 0] },
          ]
        },
        cost: {
          $cond: [
            { $and: [{ $ne: ['$hours', null] }, { $ne: [{ $ifNull: [{ $arrayElemAt: ['$memberDoc.hourly_rate', 0] }, { $arrayElemAt: ['$u.hourly_rate', 0] }] }, null] }] },
            { $multiply: ['$hours', { $ifNull: [{ $arrayElemAt: ['$memberDoc.hourly_rate', 0] }, { $arrayElemAt: ['$u.hourly_rate', 0] }] }] },
            {
              $ifNull: [
                { $divide: [{ $toDouble: '$extracted.amountInCents' }, 100] },
                { $ifNull: [{ $divide: [{ $toDouble: '$rawApiResponse.amt_in_cents' }, 100] }, 0] },
              ]
            }
          ],
        },
        team_name: {
          $ifNull: [
            { $arrayElemAt: ['$t.canonicalName', 0] },
            {
              $ifNull: [
                { $arrayElemAt: ['$t.primaryName', 0] },
                { $ifNull: ['$rawApiResponse.team.name', 'Unknown'] }
              ]
            }
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          period: '$period',
          locationId: '$locationId',
          userId: '$userId',
          teamId: '$teamId',
        },
        location_name: { $first: '$location_name' },
        user_name: { $first: '$user_name' },
        team_name: { $first: '$team_name' },
        hourly_rate: { $first: '$hourly_rate' },
        total_hours: { $sum: '$hours' },
        total_cost: { $sum: '$cost' },
        record_count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        period: '$_id.period',
        period_type: 'day',
        locationId: '$_id.locationId',
        location_name: 1,
        userId: '$_id.userId',
        user_name: 1,
        teamId: '$_id.teamId',
        team_name: 1,
        hourly_rate: 1,
        total_hours: 1,
        total_cost: 1,
        record_count: 1,
      },
    },
  ]

  const docs = await db.collection('eitje_raw_data').aggregate(pipeline).toArray() as Record<string, unknown>[]
  if (docs.length > 0) {
    await collAgg.insertMany(docs)
  }

  return { deletedPeriods: del.deletedCount, inserted: docs.length }
}
