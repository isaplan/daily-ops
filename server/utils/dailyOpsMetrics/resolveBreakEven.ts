/**
 * @registry-id: resolveBreakEven
 * @created: 2026-07-24T11:35:00.000Z
 * @last-modified: 2026-08-04T17:55:00.000Z
 * @description: Resolve day/week/month break-even from app_settings + period
 * @last-fix: [2026-08-04] Pass fixedLaborPct / flexLaborPct (ADR-019)
 * @adr-ref: ADR-014, ADR-019
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/break-even.get.ts
 */

import type { Db } from 'mongodb'
import type {
  BreakEvenAssumptionsValue,
  BreakEvenVenueKey,
  BreakEvenVenueSlice,
  DailyOpsBreakEvenBundleDto,
  DailyOpsBreakEvenDto,
} from '~/types/break-even'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'
import {
  daysInCalendarMonth,
  monthKey,
  pctVsBreakEven,
  projectBreakEvenForDays,
} from '~/utils/accountingPnlBreakEvenMath'
import { loadBreakEvenAssumptions } from '../appSettings/breakEvenAssumptionsSetting'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

export type ResolveBreakEvenInput = {
  period: string
  anchor?: string | null
  locationId?: string | null
  /** Headline revenue for the selected period (from strip/summary). */
  revenue: number
  /** Show % vs BE — false for today. */
  includePct: boolean
  /** Override projected day count (e.g. revenue analytics custom range). */
  dayCount?: number | null
  /** Per-location revenue map for byVenue rows (locationId → revenue). */
  venueRevenueByLocationId?: Record<string, number>
}

function venueFromLocationId (locationId: string | null | undefined): BreakEvenVenueKey {
  if (!locationId || locationId === 'all') return 'combined'
  const hit = DAILY_OPS_PROFIT_VENUE_LOCATIONS.find((v) => v.locationId === locationId)
  if (!hit) return 'combined'
  return hit.short.toLowerCase() as BreakEvenVenueKey
}

function locationIdFromVenue (venueId: BreakEvenVenueKey): string | null {
  if (venueId === 'combined') return null
  return DAILY_OPS_PROFIT_VENUE_LOCATIONS.find((v) => v.short.toLowerCase() === venueId)?.locationId ?? null
}

function locationNameFromVenue (venueId: BreakEvenVenueKey): string {
  if (venueId === 'combined') return 'Combined'
  return DAILY_OPS_PROFIT_VENUE_LOCATIONS.find((v) => v.short.toLowerCase() === venueId)?.label ?? venueId
}

function parseYmd (ymd: string): { year: number; month: number; day: number } | null {
  const parts = ymd.split('-')
  if (parts.length !== 3) return null
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  return { year, month, day }
}

function pickSlice (
  actualByMonth: Record<string, Record<BreakEvenVenueKey, BreakEvenVenueSlice>>,
  rolling: Record<BreakEvenVenueKey, BreakEvenVenueSlice>,
  venueId: BreakEvenVenueKey,
  year: number,
  month: number,
  preferActual: boolean,
): BreakEvenVenueSlice {
  if (preferActual) {
    const actual = actualByMonth[monthKey(year, month)]?.[venueId]
    if (actual && actual.monthlyBreakEven > 0) return actual
  }
  return rolling[venueId]
}

function granularityForPeriod (period: string): 'day' | 'week' | 'month' {
  if (period === 'this-week' || period === 'last-week') return 'week'
  if (
    period === 'this-month'
    || period === 'last-month'
    || period === 'this-year'
    || period === 'last-year'
  ) {
    return 'month'
  }
  return 'day'
}

/** Resolve business-date end for period (Amsterdam). Anchor overrides for historical days. */
function resolveEndYmd (period: string, anchor?: string | null): string {
  if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) return anchor
  const today = amsterdamOpenRegisterBusinessDateYmd()
  const d = new Date(`${today}T12:00:00.000Z`)

  if (period === 'yesterday' || period === 'd2') {
    d.setUTCDate(d.getUTCDate() - (period === 'yesterday' ? 1 : 2))
    return d.toISOString().slice(0, 10)
  }
  if (/^d[3-7]$/.test(period)) {
    const offset = Number(period.slice(1))
    d.setUTCDate(d.getUTCDate() - offset)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'last-month') {
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - 1)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const lastDay = daysInCalendarMonth(y, m)
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }
  if (period === 'last-week') {
    d.setUTCDate(d.getUTCDate() - 7)
    return d.toISOString().slice(0, 10)
  }
  return today
}

type PeriodCtx = {
  parsed: { year: number; month: number; day: number }
  granularity: 'day' | 'week' | 'month'
  preferActual: boolean
  dayCount: number
  dim: number
  includePct: boolean
}

function buildPeriodCtx (input: ResolveBreakEvenInput): PeriodCtx {
  const endYmd = resolveEndYmd(input.period, input.anchor)
  const parsed = parseYmd(endYmd) ?? parseYmd(amsterdamOpenRegisterBusinessDateYmd())!
  const granularity = granularityForPeriod(input.period)
  const todayParsed = parseYmd(amsterdamOpenRegisterBusinessDateYmd())!
  const isClosedPriorMonth =
    parsed.year < todayParsed.year
    || (parsed.year === todayParsed.year && parsed.month < todayParsed.month)
  const dim = daysInCalendarMonth(parsed.year, parsed.month)

  let dayCount = 1
  if (input.dayCount != null && input.dayCount > 0) {
    dayCount = input.dayCount
  } else if (granularity === 'week') {
    dayCount = 7
  } else if (granularity === 'month') {
    dayCount = input.period === 'this-month' ? Math.min(parsed.day, dim) : dim
  }

  return {
    parsed,
    granularity,
    preferActual: isClosedPriorMonth || (granularity === 'month' && input.period === 'last-month'),
    dayCount,
    dim,
    includePct: input.includePct && input.period !== 'today',
  }
}

function dtoFromSlice (
  venueId: BreakEvenVenueKey,
  slice: BreakEvenVenueSlice,
  revenue: number,
  ctx: PeriodCtx,
): DailyOpsBreakEvenDto {
  const breakEven = projectBreakEvenForDays(slice.monthlyBreakEven, ctx.dim, ctx.dayCount)
  return {
    venueId,
    locationId: locationIdFromVenue(venueId),
    locationName: locationNameFromVenue(venueId),
    breakEven,
    revenue,
    pctVsBreakEven: ctx.includePct ? pctVsBreakEven(revenue, breakEven) : null,
    source: slice.source,
    granularity: ctx.granularity,
    year: slice.year,
    month: slice.month,
    monthsInWindow: slice.monthsInWindow,
    monthlyBreakEven: slice.monthlyBreakEven,
    cogsPct: slice.cogsPct,
    laborPct: slice.laborPct,
    fixedLaborPct: slice.fixedLaborPct,
    flexLaborPct: slice.flexLaborPct,
  }
}

function resolveVenueDto (
  assumptions: BreakEvenAssumptionsValue,
  venueId: BreakEvenVenueKey,
  revenue: number,
  ctx: PeriodCtx,
): DailyOpsBreakEvenDto {
  const slice = pickSlice(
    assumptions.actualByMonth,
    assumptions.rolling,
    venueId,
    ctx.parsed.year,
    ctx.parsed.month,
    ctx.preferActual,
  )
  return dtoFromSlice(venueId, slice, revenue, ctx)
}

export async function resolveBreakEven (
  db: Db,
  input: ResolveBreakEvenInput,
): Promise<DailyOpsBreakEvenDto> {
  const assumptions = await loadBreakEvenAssumptions(db)
  const ctx = buildPeriodCtx(input)
  const venueId = venueFromLocationId(input.locationId)
  return resolveVenueDto(assumptions, venueId, input.revenue, ctx)
}

/** Combined row + VKB/BEA/LAT (single assumptions read). */
export async function resolveBreakEvenBundle (
  db: Db,
  input: ResolveBreakEvenInput,
): Promise<DailyOpsBreakEvenBundleDto> {
  const assumptions = await loadBreakEvenAssumptions(db)
  const ctx = buildPeriodCtx(input)
  const combined = resolveVenueDto(assumptions, 'combined', input.revenue, ctx)

  const byVenue = DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => {
    const venueId = v.short.toLowerCase() as BreakEvenVenueKey
    const rev = input.venueRevenueByLocationId?.[v.locationId] ?? 0
    return resolveVenueDto(assumptions, venueId, rev, ctx)
  })

  return { ...combined, byVenue }
}
