/**
 * @registry-id: dailyOpsInsightsBuild
 * @created: 2026-06-25T20:00:00.000Z
 * @last-modified: 2026-06-30T20:00:00.000Z
 * @description: Month/year performance insights — revenue vs staff cost vs hours
 * @last-fix: [2026-06-25] Staff costs via accounting labor calibration multiplier
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/api/daily-ops/insights.get.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsStaffTimeseriesPoint } from '~/types/daily-ops-staff'
import type {
  DailyOpsInsightsCompareRow,
  DailyOpsInsightsDelta,
  DailyOpsInsightsMetricBlock,
  DailyOpsInsightsTrendPoint,
  DailyOpsInsightsVerdict,
  DailyOpsPerformanceInsightsDto,
} from '~/types/daily-ops-insights'
import { scaleEitjeLoadedLabor } from '~/utils/accountingPnlLaborMultiplier'
import { formatAccountingProfitEstimatesNote, resolveAccountingPnlAssumptions } from '~/utils/accountingPnlAssumptions'
import {
  profitHourDefaultsFromPnlAssumptions,
} from '~/server/utils/dailyOpsMetrics/profitHour'
import { fetchStaffTimeseries } from '~/server/utils/dailyOpsStaff/fetchStaffTimeseries'
import { roundDashboardEur, formatDashboardEur } from '~/utils/dashboardEurFormat'
import { pnlFromRevenueLabor } from '~/server/utils/dailyOpsInsights/pnlFromRevenueLabor'
import type { InsightsQueryContext } from '~/server/utils/dailyOpsInsights/parseInsightsQuery'

const FOOD_SHARE_WHEN_UNKNOWN = 0.5

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, 1))
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
}

function metricsFromPoint(
  p: DailyOpsStaffTimeseriesPoint,
  locationId: string | undefined,
): DailyOpsInsightsMetricBlock {
  const rev = p.revenue_ex_vat ?? 0
  const eitjeLoaded = p.labor_loaded_cost ?? 0
  const dateForAssumptions = p.date.length === 7 ? `${p.date}-15` : p.date
  const laborCalibrated = scaleEitjeLoadedLabor(eitjeLoaded, dateForAssumptions, locationId ?? null)
  const { assumptions } = resolveAccountingPnlAssumptions(dateForAssumptions, locationId ?? null)
  const defaults = profitHourDefaultsFromPnlAssumptions(assumptions)
  const slice = pnlFromRevenueLabor(rev, laborCalibrated, FOOD_SHARE_WHEN_UNKNOWN, defaults)
  const gewerkt_hours = round2(p.gewerkt_hours)
  const revenue = roundDashboardEur(rev)
  const labor = roundDashboardEur(laborCalibrated)

  return {
    revenue,
    cogs: slice.cogs,
    labor,
    fixed_overhead: slice.fixed_overhead,
    gross_profit: slice.gross_profit,
    net_profit: slice.net_profit,
    gewerkt_hours,
    staff_count: p.staff_count,
    labor_pct_revenue: revenue > 0 ? round2((labor / revenue) * 100) : null,
    revenue_per_hour: gewerkt_hours > 0 ? round2(revenue / gewerkt_hours) : null,
    loaded_eur_per_hour: gewerkt_hours > 0 ? round2(labor / gewerkt_hours) : null,
  }
}

function emptyMetrics(): DailyOpsInsightsMetricBlock {
  return {
    revenue: 0,
    cogs: 0,
    labor: 0,
    fixed_overhead: 0,
    gross_profit: 0,
    net_profit: 0,
    gewerkt_hours: 0,
    staff_count: 0,
    labor_pct_revenue: null,
    revenue_per_hour: null,
    loaded_eur_per_hour: null,
  }
}

function pctDelta(current: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior === 0) return null
  return round2(((current - prior) / Math.abs(prior)) * 100)
}

function buildDelta(
  current: DailyOpsInsightsMetricBlock,
  prior: DailyOpsInsightsMetricBlock,
): DailyOpsInsightsDelta {
  return {
    revenue_pct: pctDelta(current.revenue, prior.revenue),
    labor_pct: pctDelta(current.labor, prior.labor),
    hours_pct: pctDelta(current.gewerkt_hours, prior.gewerkt_hours),
    staff_pct: pctDelta(current.staff_count, prior.staff_count),
    labor_pct_revenue_pp:
      current.labor_pct_revenue != null && prior.labor_pct_revenue != null
        ? round2(current.labor_pct_revenue - prior.labor_pct_revenue)
        : null,
    revenue_per_hour_pct:
      current.revenue_per_hour != null && prior.revenue_per_hour != null
        ? pctDelta(current.revenue_per_hour, prior.revenue_per_hour)
        : null,
  }
}

function fmtPctChange(pct: number | null): string {
  if (pct == null) return '—'
  const prefix = pct > 0 ? '+' : ''
  return `${prefix}${pct.toFixed(0)}%`
}

function changeDirection(pct: number | null): 'up' | 'down' | 'flat' | 'unknown' {
  if (pct == null) return 'unknown'
  if (Math.abs(pct) < 1) return 'flat'
  return pct > 0 ? 'up' : 'down'
}

function buildCompareRows(
  current: DailyOpsInsightsMetricBlock,
  prior: DailyOpsInsightsMetricBlock | null,
  delta: DailyOpsInsightsDelta | null,
): DailyOpsInsightsCompareRow[] {
  if (!prior || !delta) return []

  const rows: Array<{
    id: string
    label: string
    cur: string
    pri: string
    pct: number | null
    good: boolean | null
  }> = [
    {
      id: 'revenue',
      label: 'Revenue',
      cur: formatDashboardEur(current.revenue),
      pri: formatDashboardEur(prior.revenue),
      pct: delta.revenue_pct,
      good: delta.revenue_pct != null ? delta.revenue_pct > 0 : null,
    },
    {
      id: 'labor',
      label: 'Staff costs',
      cur: formatDashboardEur(current.labor),
      pri: formatDashboardEur(prior.labor),
      pct: delta.labor_pct,
      good: delta.labor_pct != null ? delta.labor_pct < 0 : null,
    },
    {
      id: 'hours',
      label: 'Hours worked',
      cur: `${current.gewerkt_hours.toFixed(0)}h`,
      pri: `${prior.gewerkt_hours.toFixed(0)}h`,
      pct: delta.hours_pct,
      good: null,
    },
    {
      id: 'staff',
      label: 'People who worked',
      cur: current.staff_count > 0 ? String(current.staff_count) : '—',
      pri: prior.staff_count > 0 ? String(prior.staff_count) : '—',
      pct: delta.staff_pct,
      good: null,
    },
    {
      id: 'labor_pct',
      label: 'Staff costs % of revenue',
      cur: current.labor_pct_revenue != null ? `${current.labor_pct_revenue.toFixed(1)}%` : '—',
      pri: prior.labor_pct_revenue != null ? `${prior.labor_pct_revenue.toFixed(1)}%` : '—',
      pct: delta.labor_pct_revenue_pp,
      good: delta.labor_pct_revenue_pp != null ? delta.labor_pct_revenue_pp < 0 : null,
    },
    {
      id: 'rev_h',
      label: 'Revenue per hour',
      cur: current.revenue_per_hour != null ? `€${current.revenue_per_hour.toFixed(0)}/h` : '—',
      pri: prior.revenue_per_hour != null ? `€${prior.revenue_per_hour.toFixed(0)}/h` : '—',
      pct: delta.revenue_per_hour_pct,
      good: delta.revenue_per_hour_pct != null ? delta.revenue_per_hour_pct > 0 : null,
    },
  ]

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    current: r.cur,
    prior: r.pri,
    change: r.id === 'labor_pct' && r.pct != null
      ? `${r.pct > 0 ? '+' : ''}${r.pct.toFixed(1)} pp`
      : fmtPctChange(r.pct),
    direction: changeDirection(r.pct),
    good: r.good,
  }))
}

function buildVerdict(
  current: DailyOpsInsightsMetricBlock,
  prior: DailyOpsInsightsMetricBlock | null,
  delta: DailyOpsInsightsDelta | null,
  rangeLabel: string,
  priorLabel: string | null,
  mode: InsightsQueryContext['mode'],
): DailyOpsInsightsVerdict {
  const unit = mode === 'yearly' ? 'year' : 'month'
  const laborPct = current.labor_pct_revenue

  let headline = `${rangeLabel}: ${formatDashboardEur(current.revenue)} revenue`
  if (laborPct != null) {
    headline += ` — ${laborPct.toFixed(0)}% went to staff`
  }

  const bullets: string[] = []

  if (delta && prior && priorLabel) {
    const rev = delta.revenue_pct
    if (rev != null) {
      headline += `. That's ${Math.abs(rev).toFixed(0)}% ${rev >= 0 ? 'more' : 'less'} revenue than ${priorLabel}.`
    }

    const hrs = delta.hours_pct
    const lab = delta.labor_pct
    if (
      hrs != null &&
      lab != null &&
      Math.abs(hrs) >= 5 &&
      Math.abs(lab) < Math.abs(hrs) * 0.65 &&
      current.loaded_eur_per_hour != null &&
      prior.loaded_eur_per_hour != null
    ) {
      bullets.push(
        `Hours worked ${hrs < 0 ? 'fell' : 'rose'} ${Math.abs(hrs).toFixed(0)}% but staff costs only ${lab < 0 ? 'fell' : 'rose'} ${Math.abs(lab).toFixed(0)}% — the average cost per hour changed (€${prior.loaded_eur_per_hour.toFixed(0)} → €${current.loaded_eur_per_hour.toFixed(0)}).`,
      )
    } else if (hrs != null && lab != null && Math.abs(hrs) >= 5 && Math.abs(lab) >= 5) {
      bullets.push(
        `Hours ${hrs < 0 ? 'down' : 'up'} ${Math.abs(hrs).toFixed(0)}% and staff costs ${lab < 0 ? 'down' : 'up'} ${Math.abs(lab).toFixed(0)}% vs the previous ${unit}.`,
      )
    }

    const revH = delta.revenue_per_hour_pct
    if (revH != null && Math.abs(revH) >= 5 && current.revenue_per_hour != null && prior.revenue_per_hour != null) {
      bullets.push(
        `Each hour worked brought in ${revH >= 0 ? 'more' : 'less'} revenue (€${prior.revenue_per_hour.toFixed(0)}/h → €${current.revenue_per_hour.toFixed(0)}/h).`,
      )
    }

    const laborPp = delta.labor_pct_revenue_pp
    if (laborPp != null && Math.abs(laborPp) >= 2 && prior.labor_pct_revenue != null && laborPct != null) {
      bullets.push(
        `Staff took a ${laborPp > 0 ? 'larger' : 'smaller'} slice of revenue (${prior.labor_pct_revenue.toFixed(0)}% → ${laborPct.toFixed(0)}%).`,
      )
    }
  }

  if (laborPct != null && laborPct > 42 && bullets.length < 3) {
    bullets.push('Staff costs are over 42% of revenue — worth checking rota and sales per hour.')
  }

  if (bullets.length === 0 && priorLabel) {
    bullets.push(`Compare the table below: ${rangeLabel} vs ${priorLabel}.`)
  }

  return { headline, bullets: bullets.slice(0, 3) }
}

function trendLabelForPoint(key: string, mode: InsightsQueryContext['mode']): string {
  if (mode === 'yearly') return key
  return monthLabelFromKey(key)
}

export async function buildPerformanceInsights(
  db: Db,
  ctx: InsightsQueryContext,
): Promise<DailyOpsPerformanceInsightsDto> {
  const granularity = ctx.mode === 'yearly' ? 'year' : 'month'
  const dto = await fetchStaffTimeseries(
    db,
    {
      period: 'custom',
      startDate: ctx.trendStartDate,
      endDate: ctx.trendEndDate,
      label: ctx.trendLabel,
      locationId: ctx.locationId,
    },
    granularity,
  )

  const points = (dto?.current ?? []).filter((p) => p.revenue_ex_vat != null || p.gewerkt_hours > 0)
  const metricsByKey = new Map<string, DailyOpsInsightsMetricBlock>()
  for (const p of points) {
    metricsByKey.set(p.date, metricsFromPoint(p, ctx.locationId))
  }

  const current = metricsByKey.get(ctx.current.key) ?? emptyMetrics()
  const prior = ctx.prior ? (metricsByKey.get(ctx.prior.key) ?? emptyMetrics()) : null
  const delta = prior && (prior.revenue > 0 || prior.gewerkt_hours > 0) ? buildDelta(current, prior) : null

  const compare_label = ctx.prior ? `${ctx.current.label} vs ${ctx.prior.label}` : ctx.current.label

  const trend: DailyOpsInsightsTrendPoint[] = points.map((p) => {
    const m = metricsByKey.get(p.date) ?? emptyMetrics()
    const net_pct_revenue =
      m.revenue > 0 ? round2((m.net_profit / m.revenue) * 100) : null
    const cogs_pct_revenue =
      m.revenue > 0 ? round2((m.cogs / m.revenue) * 100) : null
    return {
      date: p.date,
      label: trendLabelForPoint(p.date, ctx.mode),
      revenue: m.revenue,
      labor: m.labor,
      cogs: m.cogs,
      net_profit: m.net_profit,
      gewerkt_hours: m.gewerkt_hours,
      labor_pct_revenue: m.labor_pct_revenue,
      cogs_pct_revenue,
      net_pct_revenue,
      revenue_per_hour: m.revenue_per_hour,
    }
  })

  const { assumptions } = resolveAccountingPnlAssumptions(ctx.current.endDate, ctx.locationId ?? null)
  const assumptions_note = `${formatAccountingProfitEstimatesNote()} COGS/net estimates use ${assumptions.foodCogsPct}% food / ${assumptions.bevCogsPct}% bev when mix unknown.`
  const data_gap = current.revenue === 0 && current.gewerkt_hours === 0

  const verdict = buildVerdict(
    current,
    prior,
    delta,
    ctx.current.label,
    ctx.prior?.label ?? null,
    ctx.mode,
  )

  return {
    mode: ctx.mode,
    slot: ctx.slot,
    range: ctx.current,
    prior_range: ctx.prior,
    compare_label,
    current,
    prior,
    delta,
    verdict,
    compare_rows: buildCompareRows(current, prior, delta),
    trend,
    trend_label: ctx.trendLabel,
    assumptions_note,
    data_gap,
  }
}
