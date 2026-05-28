/**
 * @registry-id: dailyOpsMetricsWorkerStaffDetail
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Worker staff detail drawer — Eitje agg rows + snapshot revenue attribution
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsDashboardMetrics.ts (barrel)
 * ✓ server/api/daily-ops/metrics/worker-staff-detail.get.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type { DailyOpsWorkerStaffDetailDto } from '~/types/daily-ops-dashboard'
import { fetchSnapshotRevenueByDateAndLocation } from '../dailyOpsRevenue/revenueBenchmark'
import type { DailyOpsMetricsContext } from './context'

const LOC_DAY_KEY_SEP = '\x1f'

export function locationDayKey(date: string, locationId: string): string {
  return `${date}${LOC_DAY_KEY_SEP}${String(locationId)}`
}

function eitjeAggMatch(ctx: DailyOpsMetricsContext): Record<string, unknown> {
  const q: Record<string, unknown> = {
    period_type: 'day',
    period: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId !== undefined) {
    try {
      const objId = new ObjectId(ctx.locationId)
      q.locationId = { $in: [objId, ctx.locationId] }
    } catch {
      q.locationId = ctx.locationId
    }
  }
  return q
}

const EITJE_AGG_MEMBER_LOOKUP = {
  $lookup: {
    from: 'members',
    let: { uid: { $toString: '$userId' } },
    pipeline: [
      {
        $match: {
          $expr: {
            $or: [
              { $eq: [{ $toString: '$eitje_id' }, '$$uid'] },
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ['$eitje_ids', []] },
                        as: 'x',
                        cond: { $eq: [{ $toString: '$$x' }, '$$uid'] },
                      },
                    },
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
      { $limit: 1 },
      { $project: { contract_type: 1, first_name: 1, last_name: 1, name: 1 } },
    ],
    as: '_m',
  },
}

export type WorkerStaffDetailRow = {
  date: string
  locationId: string
  locationName: string
  teamId: string
  teamName: string
  userId: string
  staffName: string
  contractType: string
  totalHours: number
  totalCost: number
}

async function fetchWorkerStaffDetailRows(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<WorkerStaffDetailRow[]> {
  return (await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: eitjeAggMatch(ctx) },
      EITJE_AGG_MEMBER_LOOKUP,
      {
        $addFields: {
          contractType: {
            $ifNull: [{ $arrayElemAt: ['$_m.contract_type', 0] }, '-'],
          },
          staffName: {
            $let: {
              vars: {
                memberName: {
                  $trim: {
                    input: {
                      $concat: [
                        { $ifNull: [{ $arrayElemAt: ['$_m.first_name', 0] }, ''] },
                        ' ',
                        { $ifNull: [{ $arrayElemAt: ['$_m.last_name', 0] }, ''] },
                      ],
                    },
                  },
                },
              },
              in: {
                $cond: [
                  { $gt: [{ $strLenCP: '$$memberName' }, 0] },
                  '$$memberName',
                  {
                    $ifNull: [
                      { $arrayElemAt: ['$_m.name', 0] },
                      { $ifNull: ['$user_name', 'Unknown'] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$period',
          locationId: { $toString: '$locationId' },
          locationName: { $ifNull: ['$location_name', ''] },
          teamId: { $toString: '$teamId' },
          teamName: { $ifNull: ['$team_name', ''] },
          userId: { $toString: { $ifNull: ['$userId', ''] } },
          staffName: 1,
          contractType: 1,
          totalHours: { $round: [{ $ifNull: ['$total_hours', 0] }, 2] },
          totalCost: { $round: [{ $ifNull: ['$total_cost', 0] }, 2] },
        },
      },
      { $match: { userId: { $ne: '' } } },
      { $sort: { date: 1, locationName: 1, teamName: 1, staffName: 1 } },
    ])
    .toArray()) as WorkerStaffDetailRow[]
}

function buildWorkerStaffDetailDto(
  workerStaffDetailRaw: WorkerStaffDetailRow[],
  revByDateLocation: Map<string, number>,
): DailyOpsWorkerStaffDetailDto[] {
  const teamDayHours = new Map<string, number>()
  for (const row of workerStaffDetailRaw) {
    const k = `${row.date}|${row.locationId}|${row.teamId}`
    teamDayHours.set(k, (teamDayHours.get(k) ?? 0) + row.totalHours)
  }

  return workerStaffDetailRaw.map((row) => {
    const locK = locationDayKey(row.date, row.locationId)
    const rev = revByDateLocation.get(locK) ?? 0
    const teamH =
      teamDayHours.get(`${row.date}|${row.locationId}|${row.teamId}`) ?? row.totalHours
    let laborCostPctOfRevenue: number | null = null
    if (rev > 0 && teamH > 0) {
      const attributedRev = rev * (row.totalHours / teamH)
      if (attributedRev > 0) {
        laborCostPctOfRevenue = Math.round((row.totalCost / attributedRev) * 100 * 10) / 10
      }
    }
    return { ...row, laborCostPctOfRevenue }
  })
}

export async function fetchWorkerStaffDetailMetrics(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsWorkerStaffDetailDto[]> {
  const [workerStaffDetailRaw, revByDateLocation] = await Promise.all([
    fetchWorkerStaffDetailRows(db, ctx),
    fetchSnapshotRevenueByDateAndLocation(db, ctx.startDate, ctx.endDate, ctx.locationId),
  ])
  return buildWorkerStaffDetailDto(workerStaffDetailRaw, revByDateLocation)
}
