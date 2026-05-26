/**
 * @description: Allocate Eitje shift labor to business_date × calendar_hour (Amsterdam).
 * @last-fix: [2026-05-25] Match locationId by string inside aggregation so snapshot hourly writes per venue.
 */
import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import {
  EITJE_HOURS_ADD_FIELDS,
  EITJE_LABOR_PERIOD_FROM_SHIFT_START_FIELD,
  EITJE_LABOR_SHIFT_START_FIELD,
} from './eitjeHours'
import {
  EITJE_CONTRACT_CPH_LOOKUP,
  EITJE_NORM_NAME_FIELD,
  EITJE_RESOLVE_COST_PER_HOUR_FIELDS,
} from './eitjeLoadedCostStages'
import {
  EITJE_LOADED_COST_FIELDS,
  EITJE_NUL_UREN_EMPLOYER_CPH_OVERRIDE,
} from './eitjeLoadedCostEmployerStages'
type LaborHourCtx = {
  startDate: string
  endDate: string
  locationId?: string
}

type LaborHourOptions = {
  /** Bucket keys `locationId|businessDate|hour` for per-venue profit breakdown. */
  perLocation?: boolean
}

const AMSTERDAM_TZ = 'Europe/Amsterdam'

const EITJE_SHIFT_END_FIELD = {
  shiftEnd: {
    $ifNull: [
      { $toDate: '$rawApiResponse.end' },
      { $toDate: '$rawApiResponse.end_time' },
      { $toDate: '$rawApiResponse.ended_at' },
      { $toDate: '$rawApiResponse.to' },
      {
        $cond: [
          { $and: [{ $ne: ['$shiftStart', null] }, { $gt: [{ $ifNull: ['$hours', 0] }, 0] }] },
          { $add: ['$shiftStart', { $multiply: ['$hours', 3600000] }] },
          '$shiftStart',
        ],
      },
    ],
  },
}

function addUtcDays (d: Date, delta: number): Date {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + delta)
  return x
}

function dayStartUtc (dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEndUtc (dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

export function businessDateHourKey (date: string, hour: number): string {
  return `${date}|${hour}`
}

type AmsterdamParts = { ymd: string; hour: number; minute: number }

function amsterdamParts (instant: Date): AmsterdamParts {
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

/** UTC range for [businessDate hour:00, hour+1:00) in Amsterdam. */
function amsterdamHourWindowUtc (businessDate: string, hour: number): { startMs: number; endMs: number } {
  const baseMs = Date.parse(`${businessDate}T00:00:00.000Z`)
  for (let offsetH = -4; offsetH <= 28; offsetH++) {
    const probe = new Date(baseMs + offsetH * 3600000)
    const p = amsterdamParts(probe)
    if (p.ymd === businessDate && p.hour === hour && p.minute === 0) {
      return { startMs: probe.getTime(), endMs: probe.getTime() + 3600000 }
    }
  }
  const fallback = new Date(baseMs + hour * 3600000)
  return { startMs: fallback.getTime(), endMs: fallback.getTime() + 3600000 }
}

export type LaborByBusinessDateHourBucket = {
  loadedCost: number
  hours: number
}

function allocateShiftLabor (
  buckets: Map<string, LaborByBusinessDateHourBucket>,
  businessDate: string,
  shiftStart: Date,
  shiftEnd: Date,
  loadedCost: number,
  locationId?: string
): void {
  if (!Number.isFinite(shiftStart.getTime())) return
  const endMs = Number.isFinite(shiftEnd.getTime())
    ? shiftEnd.getTime()
    : shiftStart.getTime() + 3600000
  const startMs = shiftStart.getTime()
  const durationMs = endMs - startMs
  if (durationMs <= 0) return

  for (let h = 0; h < 24; h++) {
    const { startMs: slotStart, endMs: slotEnd } = amsterdamHourWindowUtc(businessDate, h)
    const overlapStart = Math.max(startMs, slotStart)
    const overlapEnd = Math.min(endMs, slotEnd)
    if (overlapEnd > overlapStart) {
      const fraction = (overlapEnd - overlapStart) / durationMs
      const base = businessDateHourKey(businessDate, h)
      const key = locationId ? `${locationId}|${base}` : base
      const prev = buckets.get(key) ?? { loadedCost: 0, hours: 0 }
      buckets.set(key, {
        loadedCost: prev.loadedCost + loadedCost * fraction,
        hours: prev.hours + (overlapEnd - overlapStart) / 3600000,
      })
    }
  }
}

type ShiftCostRow = {
  period: string
  shiftStart: Date
  shiftEnd: Date
  loaded_cost: number
  locationId?: string
}

/**
 * Sum loaded labor and labor hours per business_date × calendar_hour from Eitje shift start/end (Amsterdam).
 */
export async function fetchLaborByBusinessDateHour (
  db: Db,
  ctx: LaborHourCtx,
  options?: LaborHourOptions
): Promise<Map<string, LaborByBusinessDateHourBucket>> {
  const perLocation = options?.perLocation === true
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
        ...EITJE_SHIFT_END_FIELD,
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
          { $project: { hourly_rate: 1, cost_per_hour: 1, contract_type: 1 } },
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
        loaded_cost: { $round: [{ $ifNull: ['$loaded_cost', 0] }, 4] },
      },
    },
  ]

  const rows = (await db
    .collection('eitje_raw_data')
    .aggregate(pipeline)
    .toArray()) as ShiftCostRow[]

  const buckets = new Map<string, LaborByBusinessDateHourBucket>()
  for (const row of rows) {
    const start = row.shiftStart instanceof Date ? row.shiftStart : new Date(row.shiftStart)
    const end = row.shiftEnd instanceof Date ? row.shiftEnd : new Date(row.shiftEnd)
    allocateShiftLabor(
      buckets,
      row.period,
      start,
      end,
      row.loaded_cost ?? 0,
      perLocation ? row.locationId : undefined
    )
  }

  for (const [k, v] of buckets) {
    buckets.set(k, {
      loadedCost: Math.round(v.loadedCost * 100) / 100,
      hours: Math.round(v.hours * 100) / 100,
    })
  }
  return buckets
}

/**
 * Sum loaded labor cost per business_date × calendar_hour from Eitje shift start/end (Amsterdam).
 */
export async function fetchLaborCostByBusinessDateHour (
  db: Db,
  ctx: LaborHourCtx,
  options?: LaborHourOptions
): Promise<Map<string, number>> {
  const labor = await fetchLaborByBusinessDateHour(db, ctx, options)
  const cost = new Map<string, number>()
  for (const [key, row] of labor) cost.set(key, row.loadedCost)
  return cost
}
