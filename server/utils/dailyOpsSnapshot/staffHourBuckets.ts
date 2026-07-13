/**
 * @registry-id: dailyOpsStaffHourBuckets
 * @created: 2026-07-11T18:30:00.000Z
 * @last-modified: 2026-07-13T10:06:00.000Z
 * @description: Distinct staff headcount per location × business_date × calendar_hour (shift overlap)
 * @last-fix: [2026-07-13] registerBusinessDateForInstant for check-in business_date (ADR-010)
 *   Prior: [2026-07-11] Hourly staff buckets for venue strip period breakdown
 * @adr-ref: ADR-004, ADR-010, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { Db, Document } from 'mongodb'
import {
  EITJE_HOURS_ADD_FIELDS,
  EITJE_LABOR_PERIOD_FROM_SHIFT_START_FIELD,
  EITJE_LABOR_SHIFT_START_FIELD,
  buildEitjeOpenShiftHoursAddFields,
  buildEitjeShiftEndField,
} from '../eitjeHours'
import { amsterdamOpenRegisterBusinessDateYmd, registerBusinessDateForInstant } from '~/utils/dailyOpsBusinessDate'
import {
  EITJE_CONTRACT_CPH_LOOKUP,
  EITJE_NORM_NAME_FIELD,
  EITJE_RESOLVE_COST_PER_HOUR_FIELDS,
} from '../eitjeLoadedCostStages'
import {
  EITJE_LOADED_COST_FIELDS,
  EITJE_NUL_UREN_EMPLOYER_CPH_OVERRIDE,
} from '../eitjeLoadedCostEmployerStages'
import {
  classifyStaffContractType,
  type StaffContractBucketKey,
} from '~/utils/dailyOpsStaffContractBuckets'
import type { CheckInRow } from '../venueStrip/checkIns'
import { fetchVenueStripCheckIns } from '../venueStrip/checkIns'
import {
  loadMemberCompensationForStaffRows,
  resolveMemberCompensationHit,
} from '../eitjeAggCompensationEnrich'

export type StaffHourBucket = {
  staffCount: number
  byContract: Record<StaffContractBucketKey, number>
}

type StaffHourBucketInternal = {
  ft: Set<string>
  pt: Set<string>
  zzp: Set<string>
}

type StaffHourCtx = {
  startDate: string
  endDate: string
  locationId?: string
}

type ShiftStaffRow = {
  period: string
  shiftStart: Date
  shiftEnd: Date
  locationId: string
  userId: string
  contractType: string
}

function addUtcDays(d: Date, delta: number): Date {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + delta)
  return x
}

function dayStartUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEndUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

const AMSTERDAM_TZ = 'Europe/Amsterdam'

function amsterdamParts(instant: Date): { ymd: string; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMSTERDAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(instant)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  }
}

function amsterdamHourWindowUtc(
  businessDate: string,
  hour: number,
): { startMs: number; endMs: number } {
  const baseMs = Date.parse(`${businessDate}T00:00:00.000Z`)
  for (let offsetH = -4; offsetH <= 28; offsetH += 1) {
    const probe = new Date(baseMs + offsetH * 3600000)
    const p = amsterdamParts(probe)
    if (p.ymd === businessDate && p.hour === hour && p.minute === 0) {
      return { startMs: probe.getTime(), endMs: probe.getTime() + 3600000 }
    }
  }
  const fallback = new Date(baseMs + hour * 3600000)
  return { startMs: fallback.getTime(), endMs: fallback.getTime() + 3600000 }
}

function emptyInternal(): StaffHourBucketInternal {
  return { ft: new Set(), pt: new Set(), zzp: new Set() }
}

function finalizeBucket(internal: StaffHourBucketInternal): StaffHourBucket {
  const byContract = {
    ft: internal.ft.size,
    pt: internal.pt.size,
    zzp: internal.zzp.size,
  }
  return {
    staffCount: byContract.ft + byContract.pt + byContract.zzp,
    byContract,
  }
}

function allocateShiftStaff(
  buckets: Map<string, StaffHourBucketInternal>,
  businessDate: string,
  shiftStart: Date,
  shiftEnd: Date,
  userId: string,
  contractType: string,
  locationId: string,
): void {
  if (!Number.isFinite(shiftStart.getTime()) || !userId) return
  const bucketKey = classifyStaffContractType(contractType)
  if (!bucketKey) return

  const endMs = Number.isFinite(shiftEnd.getTime())
    ? shiftEnd.getTime()
    : shiftStart.getTime() + 3600000
  const startMs = shiftStart.getTime()
  if (endMs <= startMs) return

  for (let h = 0; h < 24; h += 1) {
    const { startMs: slotStart, endMs: slotEnd } = amsterdamHourWindowUtc(businessDate, h)
    const overlapStart = Math.max(startMs, slotStart)
    const overlapEnd = Math.min(endMs, slotEnd)
    if (overlapEnd <= overlapStart) continue
    const key = `${locationId}|${businessDate}|${h}`
    const prev = buckets.get(key) ?? emptyInternal()
    prev[bucketKey].add(userId)
    buckets.set(key, prev)
  }
}

export function mergeStaffHourMaps(
  base: Map<string, StaffHourBucket>,
  overlay: Map<string, StaffHourBucket>,
): Map<string, StaffHourBucket> {
  const out = new Map(base)
  for (const [key, row] of overlay) {
    const prev = out.get(key)
    if (!prev) {
      out.set(key, row)
      continue
    }
    out.set(key, {
      staffCount: Math.max(prev.staffCount, row.staffCount),
      byContract: {
        ft: Math.max(prev.byContract.ft, row.byContract.ft),
        pt: Math.max(prev.byContract.pt, row.byContract.pt),
        zzp: Math.max(prev.byContract.zzp, row.byContract.zzp),
      },
    })
  }
  return out
}

function finalizeStaffMap(
  internal: Map<string, StaffHourBucketInternal>,
): Map<string, StaffHourBucket> {
  const out = new Map<string, StaffHourBucket>()
  for (const [key, bucket] of internal) {
    const row = finalizeBucket(bucket)
    if (row.staffCount > 0) out.set(key, row)
  }
  return out
}

/** Distinct staff per location|businessDate|hour from Eitje shift overlap. */
export async function fetchStaffByBusinessDateHour(
  db: Db,
  ctx: StaffHourCtx,
): Promise<Map<string, StaffHourBucket>> {
  const startDate = ctx.startDate
  const endDate = ctx.endDate
  const startD = dayStartUtc(startDate)
  const endD = dayEndUtc(endDate)
  const looseStart = addUtcDays(startD, -2)
  const looseEnd = addUtcDays(endD, 2)

  const locationFilter: Record<string, unknown> | null =
    ctx.locationId !== undefined
      ? { $expr: { $eq: [{ $toString: '$locationId' }, String(ctx.locationId)] } }
      : null

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
    buildEitjeOpenShiftHoursAddFields(amsterdamOpenRegisterBusinessDateYmd()),
    { $addFields: buildEitjeShiftEndField(amsterdamOpenRegisterBusinessDateYmd()) },
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
          { $project: { primaryId: 1 } },
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
      },
    },
    ...(locationFilter ? [{ $match: locationFilter }] : []),
    {
      $lookup: {
        from: 'members',
        let: { uid: { $toString: { $ifNull: ['$userId', ''] } } },
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
          { $project: { contract_type: 1 } },
        ],
        as: 'memberDoc',
      },
    },
    EITJE_NORM_NAME_FIELD,
    EITJE_CONTRACT_CPH_LOOKUP,
    EITJE_RESOLVE_COST_PER_HOUR_FIELDS,
    EITJE_NUL_UREN_EMPLOYER_CPH_OVERRIDE,
    EITJE_LOADED_COST_FIELDS,
    {
      $project: {
        _id: 0,
        period: 1,
        shiftStart: 1,
        shiftEnd: 1,
        locationId: { $toString: '$locationId' },
        userId: { $toString: { $ifNull: ['$userId', ''] } },
        contractType: {
          $ifNull: [
            { $arrayElemAt: ['$memberDoc.contract_type', 0] },
            '',
          ],
        },
      },
    },
  ]

  const rows = (await db
    .collection('eitje_raw_data')
    .aggregate(pipeline as Document[])
    .toArray()) as ShiftStaffRow[]

  const buckets = new Map<string, StaffHourBucketInternal>()
  for (const row of rows) {
    const start = row.shiftStart instanceof Date ? row.shiftStart : new Date(row.shiftStart)
    const end = row.shiftEnd instanceof Date ? row.shiftEnd : new Date(row.shiftEnd)
    allocateShiftStaff(
      buckets,
      row.period,
      start,
      end,
      row.userId,
      row.contractType,
      row.locationId,
    )
  }

  return finalizeStaffMap(buckets)
}

/** Live check_ins headcount for open register day (start → now). */
export async function fetchCheckInsStaffByBusinessDateHour(
  db: Db,
  ctx: StaffHourCtx,
  checkInRows?: CheckInRow[],
): Promise<Map<string, StaffHourBucket>> {
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  if (ctx.endDate < openRegister || ctx.startDate > openRegister) {
    return new Map()
  }

  const rows =
    checkInRows ??
    (await fetchVenueStripCheckIns(db, openRegister, ctx.locationId ? [ctx.locationId] : undefined))

  const scoped = rows.filter((row) => {
    const ymd = registerBusinessDateForInstant(row.checkInStart)
    if (ymd < ctx.startDate || ymd > ctx.endDate) return false
    if (ctx.locationId && row.locationId !== ctx.locationId) return false
    return true
  })

  if (scoped.length === 0) return new Map()

  const comp = await loadMemberCompensationForStaffRows(db, scoped)
  const now = new Date()
  const buckets = new Map<string, StaffHourBucketInternal>()

  for (const row of scoped) {
    const hit = resolveMemberCompensationHit(row.userId, row.userName, comp)
    const contractType = hit?.contractType ?? ''
    const businessDate = registerBusinessDateForInstant(row.checkInStart)
    allocateShiftStaff(
      buckets,
      businessDate,
      row.checkInStart,
      now,
      row.userId,
      contractType,
      row.locationId,
    )
  }

  return finalizeStaffMap(buckets)
}
