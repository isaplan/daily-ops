/**
 * @registry-id: resolveBreakEven
 * @created: 2026-07-24T11:35:00.000Z
 * @last-modified: 2026-08-05T10:50:00.000Z
 * @description: Resolve day/week/month/year break-even — Finance P&L is SSOT for sealed months
 * @last-fix: [2026-08-05] estimatedNet uses ops revenue; accountingResult = sealed Finance only
 * @adr-ref: ADR-013, ADR-014, ADR-019, ADR-020, ADR-022
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/break-even.get.ts
 */

import type { Db } from 'mongodb'
import type {
  BreakEvenSource,
  BreakEvenVenueKey,
  BreakEvenVenueSlice,
  DailyOpsBreakEvenBundleDto,
  DailyOpsBreakEvenDto,
} from '~/types/break-even'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'
import {
  breakEvenSliceFromRow,
  daysInCalendarMonth,
  monthKey,
  pctVsBreakEven,
  projectBreakEvenForDays,
} from '~/utils/accountingPnlBreakEvenMath'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { loadBreakEvenAssumptions } from '../appSettings/breakEvenAssumptionsSetting'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import {
  fetchSealedMonthlyPnlRows,
  type SealedMonthlyPnlDoc,
} from '../accountingPnl/fetchSealedMonthlyPnlRows'
import type { AccountingPnlRow } from '~/utils/accountingPnlData'

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

const VENUE_KEYS: BreakEvenVenueKey[] = ['vkb', 'bea', 'lat', 'combined']

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

function rowForVenue (doc: SealedMonthlyPnlDoc, key: BreakEvenVenueKey): AccountingPnlRow {
  return key === 'combined' ? doc.combined : doc.venues[key]
}

/**
 * Live Finance P&L → break-even slices (SSOT for sealed months).
 * Overrides stale app_settings.actualByMonth.
 */
function buildLiveActualByMonth (
  sealed: SealedMonthlyPnlDoc[],
): Record<string, Record<BreakEvenVenueKey, BreakEvenVenueSlice>> {
  const out: Record<string, Record<BreakEvenVenueKey, BreakEvenVenueSlice>> = {}
  for (const doc of sealed) {
    const key = monthKey(doc.year, doc.month)
    const venueMap = {} as Record<BreakEvenVenueKey, BreakEvenVenueSlice>
    for (const v of VENUE_KEYS) {
      const slice = breakEvenSliceFromRow(v, rowForVenue(doc, v), 'actual_month', {
        year: doc.year,
        month: doc.month,
        monthsInWindow: 1,
      })
      if (slice) venueMap[v] = slice
    }
    if (Object.keys(venueMap).length) out[key] = venueMap
  }
  return out
}

function pickSlice (
  liveActual: Record<string, Record<BreakEvenVenueKey, BreakEvenVenueSlice>>,
  rolling: Record<BreakEvenVenueKey, BreakEvenVenueSlice>,
  venueId: BreakEvenVenueKey,
  year: number,
  month: number,
): BreakEvenVenueSlice {
  const live = liveActual[monthKey(year, month)]?.[venueId]
  if (live && live.monthlyBreakEven > 0) return live
  return rolling[venueId]
}

function granularityForPeriod (period: string): 'day' | 'week' | 'month' | 'year' {
  if (period === 'this-week' || period === 'last-week') return 'week'
  if (period === 'this-year' || period === 'last-year') return 'year'
  if (period === 'this-month' || period === 'last-month') return 'month'
  return 'day'
}

type MonthSpan = { year: number; month: number; dayCount: number; daysInMonth: number }

/** Calendar months touched by [startDate, endDate], with day counts for partial months. */
function enumerateMonthSpans (startDate: string, endDate: string): MonthSpan[] {
  const start = parseYmd(startDate)
  const end = parseYmd(endDate)
  if (!start || !end || startDate > endDate) return []

  const out: MonthSpan[] = []
  let y = start.year
  let m = start.month
  while (y < end.year || (y === end.year && m <= end.month)) {
    const dim = daysInCalendarMonth(y, m)
    const monthStartDay = y === start.year && m === start.month ? start.day : 1
    const monthEndDay = y === end.year && m === end.month ? end.day : dim
    const dayCount = Math.max(0, monthEndDay - monthStartDay + 1)
    if (dayCount > 0) {
      out.push({ year: y, month: m, dayCount, daysInMonth: dim })
    }
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function round1 (n: number): number {
  return Math.round(n * 10) / 10
}

type PeriodCtx = {
  period: string
  startDate: string
  endDate: string
  parsed: { year: number; month: number; day: number }
  granularity: 'day' | 'week' | 'month' | 'year'
  dayCount: number
  dim: number
  includePct: boolean
  monthSpans: MonthSpan[]
}

function buildPeriodCtx (input: ResolveBreakEvenInput): PeriodCtx {
  const range = resolveDailyOpsPeriod(input.period, input.anchor ?? undefined)
  const endYmd = range.endDate
  const parsed = parseYmd(endYmd) ?? parseYmd(amsterdamOpenRegisterBusinessDateYmd())!
  const granularity = granularityForPeriod(input.period)
  const dim = daysInCalendarMonth(parsed.year, parsed.month)
  const monthSpans = enumerateMonthSpans(range.startDate, range.endDate)

  let dayCount = monthSpans.reduce((s, m) => s + m.dayCount, 0)
  if (input.dayCount != null && input.dayCount > 0) {
    dayCount = input.dayCount
  } else if (granularity === 'week') {
    dayCount = 7
  } else if (granularity === 'month' && monthSpans.length <= 1) {
    dayCount = input.period === 'this-month' ? Math.min(parsed.day, dim) : dim
  } else if (dayCount <= 0) {
    dayCount = 1
  }

  return {
    period: input.period,
    startDate: range.startDate,
    endDate: range.endDate,
    parsed,
    granularity,
    dayCount,
    dim,
    includePct: input.includePct && input.period !== 'today',
    monthSpans,
  }
}

function emptySlice (venueId: BreakEvenVenueKey): BreakEvenVenueSlice {
  return {
    venueId,
    monthlyBreakEven: 0,
    monthlyRevenue: 0,
    monthlyLabor: 0,
    monthlyFixedLabor: 0,
    monthlyFlexLabor: 0,
    monthlyCogs: 0,
    monthlyFixed: 0,
    cogsPct: 0,
    laborPct: 0,
    fixedLaborPct: 0,
    flexLaborPct: 0,
    source: 'default',
    year: null,
    month: null,
    monthsInWindow: 0,
  }
}

function blendSource (sources: Set<BreakEvenSource>): BreakEvenSource {
  if (sources.size === 0) return 'default'
  if (sources.size === 1) return [...sources][0]!
  return 'blended'
}

/** Sum CM break-even across every calendar month (Finance live for sealed; rolling else). */
function sumBreakEvenForSpans (
  liveActual: Record<string, Record<BreakEvenVenueKey, BreakEvenVenueSlice>>,
  rolling: Record<BreakEvenVenueKey, BreakEvenVenueSlice>,
  venueId: BreakEvenVenueKey,
  spans: MonthSpan[],
): { breakEven: number; slice: BreakEvenVenueSlice; source: BreakEvenSource } {
  if (!spans.length) {
    return { breakEven: 0, slice: emptySlice(venueId), source: 'default' }
  }

  let breakEven = 0
  let revW = 0
  let cogsW = 0
  let fixedLaborW = 0
  let flexLaborW = 0
  let laborW = 0
  const sources = new Set<BreakEvenSource>()
  let lastSlice = emptySlice(venueId)

  for (const span of spans) {
    const slice = pickSlice(liveActual, rolling, venueId, span.year, span.month)
    lastSlice = slice
    sources.add(slice.source)
    breakEven += projectBreakEvenForDays(slice.monthlyBreakEven, span.daysInMonth, span.dayCount)
    const w = Math.max(span.dayCount, 1)
    revW += slice.monthlyRevenue * w
    cogsW += (slice.cogsPct / 100) * slice.monthlyRevenue * w
    fixedLaborW += (slice.fixedLaborPct / 100) * slice.monthlyRevenue * w
    flexLaborW += (slice.flexLaborPct / 100) * slice.monthlyRevenue * w
    laborW += (slice.laborPct / 100) * slice.monthlyRevenue * w
  }

  const source = blendSource(sources)

  const blended: BreakEvenVenueSlice = {
    ...lastSlice,
    venueId,
    monthlyBreakEven: spans.length === 1 ? lastSlice.monthlyBreakEven : round2(breakEven / spans.length),
    cogsPct: revW > 0 ? round1((cogsW / revW) * 100) : lastSlice.cogsPct,
    fixedLaborPct: revW > 0 ? round1((fixedLaborW / revW) * 100) : lastSlice.fixedLaborPct,
    flexLaborPct: revW > 0 ? round1((flexLaborW / revW) * 100) : lastSlice.flexLaborPct,
    laborPct: revW > 0 ? round1((laborW / revW) * 100) : lastSlice.laborPct,
    source,
    monthsInWindow: spans.length,
    year: spans[0]?.year ?? null,
    month: spans.length === 1 ? (spans[0]?.month ?? null) : null,
  }

  return { breakEven: round2(breakEven), slice: blended, source }
}

/** CM-model Est. net on **ops** span revenue: (opsRev − BE) × (1 − cogs% − flex%). */
function cmEstimateOnOpsRevenue (
  slice: BreakEvenVenueSlice,
  span: MonthSpan,
  opsSpanRevenue: number,
): number {
  if (!(slice.monthlyBreakEven > 0) || !(opsSpanRevenue > 0)) return 0
  const spanBe = projectBreakEvenForDays(slice.monthlyBreakEven, span.daysInMonth, span.dayCount)
  const cm = 1 - slice.cogsPct / 100 - slice.flexLaborPct / 100
  if (!(cm > 0)) return 0
  return (opsSpanRevenue - spanBe) * cm
}

/**
 * Est. net composition (ADR-022):
 * - `accountingResult` = sealed Finance `result` only (never a CM invent).
 * - `estimatedNet` = sealed sum + CM on **ops headline revenue** for open spans.
 */
function composePeriodNet (
  sealedByKey: Map<string, SealedMonthlyPnlDoc>,
  liveActual: Record<string, Record<BreakEvenVenueKey, BreakEvenVenueSlice>>,
  rolling: Record<BreakEvenVenueKey, BreakEvenVenueSlice>,
  venueId: BreakEvenVenueKey,
  spans: MonthSpan[],
  periodOpsRevenue: number,
): { accountingResult: number | null; estimatedNet: number | null } {
  if (!spans.length) return { accountingResult: null, estimatedNet: null }

  const totalDays = spans.reduce((s, sp) => s + sp.dayCount, 0)
  let sealedSum = 0
  let sealedHits = 0
  let openEst = 0
  let openHits = 0

  for (const span of spans) {
    const doc = sealedByKey.get(monthKey(span.year, span.month))
    if (doc) {
      const row = rowForVenue(doc, venueId)
      const monthResult = Number(row.result ?? 0)
      if (!Number.isFinite(monthResult)) continue
      sealedHits++
      sealedSum += monthResult * (span.dayCount / span.daysInMonth)
      continue
    }
    const slice = pickSlice(liveActual, rolling, venueId, span.year, span.month)
    if (!(slice.monthlyBreakEven > 0)) continue
    const opsSpanRev = totalDays > 0
      ? periodOpsRevenue * (span.dayCount / totalDays)
      : 0
    openHits++
    openEst += cmEstimateOnOpsRevenue(slice, span, opsSpanRev)
  }

  const accountingResult = sealedHits > 0 ? round2(sealedSum) : null
  if (sealedHits === 0 && openHits === 0) {
    return { accountingResult: null, estimatedNet: null }
  }
  return {
    accountingResult,
    estimatedNet: round2(sealedSum + openEst),
  }
}

function dtoFromResolved (
  venueId: BreakEvenVenueKey,
  breakEven: number,
  slice: BreakEvenVenueSlice,
  revenue: number,
  ctx: PeriodCtx,
  accountingResult: number | null,
  estimatedNet: number | null,
): DailyOpsBreakEvenDto {
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
    accountingResult,
    estimatedNet,
  }
}

function resolveVenueDto (
  liveActual: Record<string, Record<BreakEvenVenueKey, BreakEvenVenueSlice>>,
  rolling: Record<BreakEvenVenueKey, BreakEvenVenueSlice>,
  sealedByKey: Map<string, SealedMonthlyPnlDoc>,
  venueId: BreakEvenVenueKey,
  revenue: number,
  ctx: PeriodCtx,
): DailyOpsBreakEvenDto {
  const { accountingResult, estimatedNet } = composePeriodNet(
    sealedByKey,
    liveActual,
    rolling,
    venueId,
    ctx.monthSpans,
    revenue,
  )
  const multiMonth = ctx.monthSpans.length > 1 || ctx.granularity === 'year'

  if (multiMonth) {
    const summed = sumBreakEvenForSpans(liveActual, rolling, venueId, ctx.monthSpans)
    return dtoFromResolved(
      venueId,
      summed.breakEven,
      summed.slice,
      revenue,
      ctx,
      accountingResult,
      estimatedNet,
    )
  }

  const span = ctx.monthSpans[0]
  const y = span?.year ?? ctx.parsed.year
  const m = span?.month ?? ctx.parsed.month
  const slice = pickSlice(liveActual, rolling, venueId, y, m)
  const breakEven = projectBreakEvenForDays(
    slice.monthlyBreakEven,
    span?.daysInMonth ?? ctx.dim,
    span?.dayCount ?? ctx.dayCount,
  )
  return dtoFromResolved(
    venueId,
    breakEven,
    slice,
    revenue,
    ctx,
    accountingResult,
    estimatedNet,
  )
}

type SealedContext = {
  liveActual: Record<string, Record<BreakEvenVenueKey, BreakEvenVenueSlice>>
  sealedByKey: Map<string, SealedMonthlyPnlDoc>
  rolling: Record<BreakEvenVenueKey, BreakEvenVenueSlice>
}

async function loadSealedContext (db: Db): Promise<SealedContext> {
  const assumptions = await loadBreakEvenAssumptions(db)
  /** Cover last-year (12) + this-year YTD + buffer. */
  const sealed = await fetchSealedMonthlyPnlRows(db, { limit: 48 })
  const liveActual = buildLiveActualByMonth(sealed)
  const sealedByKey = new Map(sealed.map((d) => [monthKey(d.year, d.month), d]))
  return { liveActual, sealedByKey, rolling: assumptions.rolling }
}

export async function resolveBreakEven (
  db: Db,
  input: ResolveBreakEvenInput,
): Promise<DailyOpsBreakEvenDto> {
  const ctx = buildPeriodCtx(input)
  const { liveActual, sealedByKey, rolling } = await loadSealedContext(db)
  const venueId = venueFromLocationId(input.locationId)
  return resolveVenueDto(liveActual, rolling, sealedByKey, venueId, input.revenue, ctx)
}

/** Combined row + VKB/BEA/LAT (single sealed + assumptions load). */
export async function resolveBreakEvenBundle (
  db: Db,
  input: ResolveBreakEvenInput,
): Promise<DailyOpsBreakEvenBundleDto> {
  const ctx = buildPeriodCtx(input)
  const { liveActual, sealedByKey, rolling } = await loadSealedContext(db)
  const combined = resolveVenueDto(liveActual, rolling, sealedByKey, 'combined', input.revenue, ctx)

  const byVenue = DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => {
    const venueId = v.short.toLowerCase() as BreakEvenVenueKey
    const rev = input.venueRevenueByLocationId?.[v.locationId] ?? 0
    return resolveVenueDto(liveActual, rolling, sealedByKey, venueId, rev, ctx)
  })

  return { ...combined, byVenue }
}

/** Exported for unit-style checks (month span enumeration). */
export const __test = {
  enumerateMonthSpans,
  composePeriodNet,
  buildLiveActualByMonth,
  pickSlice,
  blendSource,
  cmEstimateOnOpsRevenue,
}
