/**
 * @registry-id: eitjeRebuildAggregationService
 * @created: 2026-04-05T12:00:00.000Z
 * @last-modified: 2026-05-19T20:30:00.000Z
 * @description: Rebuilds eitje_time_registration_aggregation day rows from eitje_raw_data for a date range
 * @last-fix: [2026-05-19] Member lookup also matches support_id; hourly_rate falls back to inbox contract.
 *   Prior: [2026-05-16] aggregatedAt on write; string keys; dedupe after insert.
 *   Prior: [2026-05-16] Dedupe agg rows after insert (concurrent rebuild race).
 *   Prior: [2026-05-14] Nul-uren: employer cost_per_hour = hourly_rate × 1.36 before loaded math.
 *   Prior: [2026-05-14] cost_per_hour + total_cost_loaded; members eitje_id string cast fix.
 *
 * @exports-to:
 * ✓ server/services/eitjeSyncService.ts
 * ✓ server/api/eitje/v2/sync.post.ts (optional future)
 * ✓ server/utils/dailyOpsSnapshot/buildLaborSection.ts (consumes total_cost_loaded)
 */

import type { Db } from 'mongodb'
import {
  EITJE_HOURS_ADD_FIELDS,
  EITJE_LABOR_PERIOD_FROM_SHIFT_START_FIELD,
  EITJE_LABOR_SHIFT_START_FIELD,
} from '../utils/eitjeHours'
import {
  EITJE_CONTRACT_CPH_LOOKUP,
  EITJE_NORM_NAME_FIELD,
  EITJE_RESOLVE_COST_PER_HOUR_FIELDS,
} from '../utils/eitjeLoadedCostStages'
import {
  EITJE_LOADED_COST_FIELDS,
  EITJE_NUL_UREN_EMPLOYER_CPH_OVERRIDE,
} from '../utils/eitjeLoadedCostEmployerStages'
import { fixAggregationDuplicates } from './dataIntegrityService'
import { enqueueSnapshotBuild } from '../utils/dailyOpsSnapshot/jobCoalescer'

function addUtcDays (d: Date, delta: number): Date {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + delta)
  return x
}

export type RebuildAggResult = {
  deletedPeriods: number
  inserted: number
  aggDeduped: number
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
  /** Pull a padded UTC window on stored `date`, then keep rows whose labor `period` falls in [startDate,endDate]. */
  const looseStart = addUtcDays(startD, -2)
  const looseEnd = addUtcDays(endD, 2)

  const pipeline: unknown[] = [
    {
      $match: {
        endpoint: 'time_registration_shifts',
        date: { $gte: looseStart, $lte: looseEnd },
      },
    },
    {
      $addFields: {
        ...EITJE_HOURS_ADD_FIELDS,
        ...EITJE_LABOR_SHIFT_START_FIELD,
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
    { $addFields: EITJE_LABOR_PERIOD_FROM_SHIFT_START_FIELD },
    {
      $match: {
        $expr: {
          $and: [{ $gte: ['$period', startDate] }, { $lte: ['$period', endDate] }],
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
        let: { uid: { $toString: { $ifNull: ['$userId', ''] } } },
        pipeline: [
          {
            $addFields: {
              _eitje_id_str: { $toString: { $ifNull: ['$eitje_id', ''] } },
              _eitje_ids_str: {
                $map: {
                  input: { $ifNull: ['$eitje_ids', []] },
                  as: 'x',
                  in: { $toString: '$$x' },
                },
              },
            },
          },
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$_eitje_id_str', '$$uid'] },
                  { $in: ['$$uid', '$_eitje_ids_str'] },
                  {
                    $eq: [
                      { $toString: { $ifNull: ['$support_id', ''] } },
                      '$$uid',
                    ],
                  },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { hourly_rate: 1, hourly_wage: 1, cost_per_hour: 1, contract_type: 1 } },
        ],
        as: 'memberDoc',
      },
    },
    EITJE_NORM_NAME_FIELD,
    EITJE_CONTRACT_CPH_LOOKUP,
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
            { $arrayElemAt: ['$memberDoc.hourly_wage', 0] },
            { $arrayElemAt: ['$u.hourly_rate', 0] },
            { $arrayElemAt: ['$contractDoc.hourly_rate', 0] },
            { $arrayElemAt: ['$contractDoc.hourly_wage', 0] },
          ],
        },
        cost: {
          $cond: [
            {
              $and: [
                { $ne: ['$hours', null] },
                { $ne: ['$hourly_rate', null] },
              ],
            },
            { $multiply: ['$hours', '$hourly_rate'] },
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
    EITJE_RESOLVE_COST_PER_HOUR_FIELDS,
    EITJE_NUL_UREN_EMPLOYER_CPH_OVERRIDE,
    EITJE_LOADED_COST_FIELDS,
    {
      $addFields: {
        locationIdNorm: { $toString: '$locationId' },
        userIdNorm: { $toString: { $ifNull: ['$userId', ''] } },
        teamIdNorm: { $toString: { $ifNull: ['$teamId', ''] } },
      },
    },
    {
      $group: {
        _id: {
          period: '$period',
          locationId: '$locationIdNorm',
          userId: '$userIdNorm',
          teamId: '$teamIdNorm',
        },
        location_name: { $first: '$location_name' },
        user_name: { $first: '$user_name' },
        team_name: { $first: '$team_name' },
        hourly_rate: { $first: '$hourly_rate' },
        cost_per_hour: { $first: '$cost_per_hour' },
        loaded_cost_source: { $first: '$loaded_cost_source' },
        total_hours: { $sum: '$hours' },
        total_cost: { $sum: '$cost' },
        total_cost_loaded: { $sum: '$loaded_cost' },
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
        cost_per_hour: 1,
        loaded_cost_source: 1,
        total_hours: 1,
        total_cost: 1,
        total_cost_loaded: 1,
        record_count: 1,
      },
    },
  ]

  const builtAt = new Date()
  const docs = (await db.collection('eitje_raw_data').aggregate(pipeline).toArray()) as Record<string, unknown>[]
  for (const doc of docs) {
    doc.aggregatedAt = builtAt
    doc.locationId = String(doc.locationId ?? '')
    doc.userId = String(doc.userId ?? '')
    doc.teamId = String(doc.teamId ?? '')
  }
  if (docs.length > 0) {
    await collAgg.insertMany(docs)
  }

  const aggDeduped = await fixAggregationDuplicates({ startDate, endDate })

  const periods = await collAgg.distinct('period', {
    period_type: 'day',
    period: { $gte: startDate, $lte: endDate },
  })
  for (const period of periods) {
    const locs = await collAgg.distinct('locationId', { period_type: 'day', period })
    for (const loc of locs) {
      enqueueSnapshotBuild({ businessDate: String(period), locationId: String(loc) })
    }
  }

  return { deletedPeriods: del.deletedCount, inserted: docs.length, aggDeduped }
}
