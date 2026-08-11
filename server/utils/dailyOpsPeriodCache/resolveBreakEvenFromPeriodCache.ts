/**
 * @registry-id: dailyOpsPeriodCacheResolveBreakEven
 * @created: 2026-08-09T00:30:00.000Z
 * @last-modified: 2026-08-10T23:05:00.000Z
 * @description: BE / Est.net from period-cache + ratio snapshots (Today uses ratio day project)
 * @last-fix: [2026-08-10] Project monthly BE → period days when nodes missing (Today strip)
 *   Prior: [2026-08-09] Cutover from resolveBreakEven live path
 * @adr-ref: PERIOD_CACHE_ADR L2, L3, L4
 * @data-source: period-cache | daily_ops_ratio_snapshots
 * @read-cache-json: daily_ops_period_cache · resolvePeriodRange; ratios for open/Today
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/break-even.get.ts
 */

import type { Db } from 'mongodb'
import type {
  BreakEvenSource,
  BreakEvenVenueKey,
  DailyOpsBreakEvenBundleDto,
  DailyOpsBreakEvenDto,
} from '~/types/break-even'
import { ACCOUNTING_PNL_LOCATION_ID_TO_VENUE } from '~/utils/accountingPnlData'
import {
  daysInCalendarMonth,
  pctVsBreakEven,
  projectBreakEvenForDays,
} from '~/utils/accountingPnlBreakEvenMath'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import { findPeriodNode } from './store'
import { loadRatioSnapshotForDay } from './ratioSnapshot'
import { resolvePeriodRange, sumResolvedNodes } from './resolvePeriodRange'

export type ResolveBreakEvenFromCacheInput = {
  period: string
  anchor?: string | null
  locationId?: string | null
  revenue: number
  includePct: boolean
  dayCount?: number | null
  venueRevenueByLocationId?: Record<string, number>
}

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function venueKeyFromLocationId (locationId: string | null | undefined): BreakEvenVenueKey {
  if (!locationId || locationId === 'all') return 'combined'
  return ACCOUNTING_PNL_LOCATION_ID_TO_VENUE[locationId] ?? 'combined'
}

function locationIdFromVenue (venueId: BreakEvenVenueKey): string | null {
  if (venueId === 'combined') return null
  return DAILY_OPS_PROFIT_VENUE_LOCATIONS.find((v) => v.short.toLowerCase() === venueId)?.locationId ?? null
}

function locationNameFromVenue (venueId: BreakEvenVenueKey): string {
  if (venueId === 'combined') return 'Combined'
  return DAILY_OPS_PROFIT_VENUE_LOCATIONS.find((v) => v.short.toLowerCase() === venueId)?.label ?? venueId
}

function granularityForPeriod (period: string): 'day' | 'week' | 'month' | 'year' {
  if (period === 'this-week' || period === 'last-week') return 'week'
  if (period === 'this-year' || period === 'last-year') return 'year'
  if (period === 'this-month' || period === 'last-month') return 'month'
  return 'day'
}

function blendSource (sources: Set<BreakEvenSource>): BreakEvenSource {
  if (sources.size === 0) return 'default'
  if (sources.size === 1) return [...sources][0]!
  return 'blended'
}

function mapRatioSource (raw: string | undefined): BreakEvenSource {
  if (raw === 'finance_sealed') return 'actual_month'
  if (raw === 'rolling_12m') return 'rolling_12m'
  if (raw === 'blended') return 'blended'
  return 'default'
}

async function resolveOneVenue (
  db: Db,
  input: ResolveBreakEvenFromCacheInput,
  venueId: BreakEvenVenueKey,
  revenue: number,
): Promise<DailyOpsBreakEvenDto> {
  const range = resolveDailyOpsPeriod(input.period, input.anchor ?? undefined)
  const locationId = venueId === 'combined'
    ? 'all'
    : (locationIdFromVenue(venueId) ?? 'all')

  const cover = await resolvePeriodRange(db, {
    startDate: range.startDate,
    endDate: range.endDate,
    locationId,
  })
  const summed = sumResolvedNodes(cover.nodes)

  const sources = new Set<BreakEvenSource>()
  let accountingResult: number | null = null
  let sealedNet = 0
  let sealedHits = 0
  let openNet = 0

  for (const node of cover.nodes) {
    sources.add(mapRatioSource(node.ratios.source))
    if (node.status === 'finance_sealed' || node.ratios.source === 'finance_sealed') {
      sealedHits++
      sealedNet += node.ratios.netProfit
    } else {
      openNet += node.ratios.netProfit
    }
  }

  if (sealedHits > 0) accountingResult = round2(sealedNet)

  const monthKey = range.startDate.slice(0, 7)
  const monthNode = await findPeriodNode(db, {
    locationId,
    level: 'month',
    periodKey: monthKey,
  })
  const isFullMonth = Boolean(
    monthNode
    && range.startDate === monthNode.businessDateStart
    && range.endDate === monthNode.businessDateEnd,
  )

  let breakEven = summed.breakEven
  let estimatedNet = round2(sealedNet + openNet)
  let cogsPct = 0
  let laborPct = 0
  let fixedLaborPct = 0
  let flexLaborPct = 0
  let monthlyBreakEven = 0
  let year: number | null = null
  let month: number | null = null
  let monthsInWindow = Math.max(cover.nodes.length, 1)
  let source = blendSource(sources)

  if (monthNode && (isFullMonth || (cover.nodes.length === 1 && cover.nodes[0]?.level === 'month'))) {
    breakEven = monthNode.ratios.breakEven
    estimatedNet = monthNode.ratios.netProfit
    cogsPct = monthNode.ratios.cogsPct
    laborPct = monthNode.ratios.laborPct
    fixedLaborPct = monthNode.ratios.fixedLaborPct
    flexLaborPct = monthNode.ratios.flexLaborPct
    monthlyBreakEven = monthNode.ratios.breakEven
    source = mapRatioSource(monthNode.ratios.source)
    if (monthNode.status === 'finance_sealed' || monthNode.ratios.source === 'finance_sealed') {
      accountingResult = monthNode.ratios.netProfit
      estimatedNet = monthNode.ratios.netProfit
    }
    const [y, m] = monthKey.split('-').map(Number)
    year = y ?? null
    month = m ?? null
    monthsInWindow = 1
  } else {
    const ratio = await loadRatioSnapshotForDay(db, range.endDate, locationId)
    cogsPct = ratio?.cogsPct ?? 0
    fixedLaborPct = ratio?.fixedLaborPct ?? 0
    flexLaborPct = ratio?.flexLaborPct ?? 0
    laborPct = round2(fixedLaborPct + flexLaborPct)
    monthlyBreakEven = ratio?.breakEvenMonthly ?? 0
    if (ratio?.source === 'finance_sealed') source = 'actual_month'
    else if (ratio?.source === 'rolling_12m' && sources.size <= 1) source = 'rolling_12m'
    year = Number(range.endDate.slice(0, 4)) || null
    month = cover.nodes.length === 1 ? Number(range.endDate.slice(5, 7)) || null : null
  }

  // Today / open spans often have no sealed day node yet — still show period BE from ratio monthly.
  if (!(breakEven > 0) && monthlyBreakEven > 0) {
    const y = year ?? Number(range.endDate.slice(0, 4))
    const m = month ?? Number(range.endDate.slice(5, 7))
    const dim = daysInCalendarMonth(y, m)
    const dayCount =
      input.dayCount != null && input.dayCount > 0
        ? Math.round(input.dayCount)
        : enumerateUtcDatesInclusive(range.startDate, range.endDate).length
    breakEven = projectBreakEvenForDays(monthlyBreakEven, dim, Math.max(dayCount, 1))
  }

  if (
    accountingResult == null
    && (!(Number.isFinite(estimatedNet) && estimatedNet !== 0) || cover.nodes.length === 0)
    && breakEven > 0
  ) {
    const cm = Math.max(0, 1 - cogsPct / 100 - flexLaborPct / 100)
    estimatedNet = round2((revenue - breakEven) * cm)
  }

  const includePct = input.includePct && input.period !== 'today'
  const granularity = granularityForPeriod(input.period)

  return {
    venueId,
    locationId: locationIdFromVenue(venueId),
    locationName: locationNameFromVenue(venueId),
    breakEven: round2(breakEven),
    revenue,
    pctVsBreakEven: includePct ? pctVsBreakEven(revenue, breakEven) : null,
    source,
    granularity,
    year,
    month,
    monthsInWindow,
    monthlyBreakEven: round2(monthlyBreakEven),
    cogsPct,
    laborPct,
    fixedLaborPct,
    flexLaborPct,
    accountingResult,
    estimatedNet: Number.isFinite(estimatedNet) ? estimatedNet : null,
  }
}

export async function resolveBreakEvenFromPeriodCache (
  db: Db,
  input: ResolveBreakEvenFromCacheInput,
): Promise<DailyOpsBreakEvenDto> {
  const venueId = venueKeyFromLocationId(input.locationId)
  return resolveOneVenue(db, input, venueId, input.revenue)
}

export async function resolveBreakEvenBundleFromPeriodCache (
  db: Db,
  input: ResolveBreakEvenFromCacheInput,
): Promise<DailyOpsBreakEvenBundleDto> {
  const combined = await resolveOneVenue(db, input, 'combined', input.revenue)
  const byVenue = await Promise.all(
    DAILY_OPS_PROFIT_VENUE_LOCATIONS.map(async (v) => {
      const venueId = v.short.toLowerCase() as BreakEvenVenueKey
      const rev = input.venueRevenueByLocationId?.[v.locationId] ?? 0
      return resolveOneVenue(db, input, venueId, rev)
    }),
  )
  return { ...combined, byVenue }
}
