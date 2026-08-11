/**
 * @registry-id: buildPnlAnalytics
 * @created: 2026-08-11T12:55:00.000Z
 * @last-modified: 2026-08-11T13:05:00.000Z
 * @description: Finance Analytics from sealed accounting_pnl_benchmark months
 * @last-fix: [2026-08-11] Attach monthly active staff FT/PT/ZZP (period-cache)
 * @adr-ref: ADR-022, ADR-004
 *
 * @exports-to:
 * ✓ server/api/daily-ops/finance/analytics.get.ts
 * ✓ server/api/daily-ops/finance/analytics/staff.get.ts
 */

import type { Db } from 'mongodb'
import type {
  AccountingPnlAnalyticsDto,
  AccountingPnlAnalyticsPoint,
  AccountingPnlAnalyticsSeasonal,
  AccountingPnlAnalyticsStaffPoint,
  AccountingPnlAnalyticsVenue,
  AccountingPnlAnalyticsVerdict,
} from '~/types/accounting-pnl-analytics'
import type { AccountingPnlRow, AccountingPnlVenueId } from '~/utils/accountingPnlData'
import {
  ACCOUNTING_PNL_LOCATION_ID_TO_VENUE,
  ACCOUNTING_PNL_MONTH_LABELS,
  ACCOUNTING_PNL_MONTH_LONG_LABELS,
} from '~/utils/accountingPnlData'
import { formatAccountingPnlCompact } from '~/utils/accountingPnlFormat'
import { fetchSealedMonthlyPnlRows } from '~/server/utils/accountingPnl/fetchSealedMonthlyPnlRows'
import { fetchStaffDailyLaborRows } from '~/server/utils/dailyOpsStaff/fetchStaffDailyLabor'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function pctDelta (current: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior === 0) return null
  return round2(((current - prior) / Math.abs(prior)) * 100)
}

function pctOf (part: number, whole: number): number | null {
  if (!Number.isFinite(whole) || whole <= 0) return null
  return round2((part / whole) * 100)
}

function monthKey (year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthLabel (year: number, month: number): string {
  const name = ACCOUNTING_PNL_MONTH_LABELS[month - 1] ?? String(month)
  return `${name} ${year}`
}

function lastDayOfMonth (year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0))
  return d.toISOString().slice(0, 10)
}

function locationIdForVenue (venue: AccountingPnlVenueId): string | undefined {
  for (const [locationId, id] of Object.entries(ACCOUNTING_PNL_LOCATION_ID_TO_VENUE)) {
    if (id === venue) return locationId
  }
  return undefined
}

function pointFromRow (year: number, month: number, row: AccountingPnlRow): AccountingPnlAnalyticsPoint {
  const revenue = row.revenue
  return {
    date: monthKey(year, month),
    label: monthLabel(year, month),
    year,
    month,
    revenue,
    labor: row.labor,
    cogs: row.cogs,
    fixed: row.fixed,
    result: row.result,
    labor_pct: pctOf(row.labor, revenue),
    cogs_pct: pctOf(row.cogs, revenue),
    result_pct: pctOf(row.result, revenue),
  }
}

function dirWord (pct: number): string {
  return pct >= 0 ? 'up' : 'down'
}

function buildVerdict (
  latest: AccountingPnlAnalyticsPoint | null,
  priorMonth: AccountingPnlAnalyticsPoint | null,
  priorYearSame: AccountingPnlAnalyticsPoint | null,
  latestStaff: AccountingPnlAnalyticsStaffPoint | null,
  priorStaff: AccountingPnlAnalyticsStaffPoint | null,
): AccountingPnlAnalyticsVerdict {
  if (!latest) {
    return { headline: 'No sealed monthly P&L yet.', bullets: [] }
  }

  const bullets: string[] = []
  let headline = `${latest.label}: ${formatAccountingPnlCompact(latest.revenue)} revenue`

  if (latest.labor_pct != null) {
    headline += ` — staff ${latest.labor_pct.toFixed(0)}% of sales`
  }

  if (priorYearSame) {
    const revYoY = pctDelta(latest.revenue, priorYearSame.revenue)
    if (revYoY != null) {
      headline += `. Same month last year was ${formatAccountingPnlCompact(priorYearSame.revenue)} (${dirWord(revYoY)} ${Math.abs(revYoY).toFixed(0)}% YoY).`
    }
  }

  if (priorMonth) {
    const rev = pctDelta(latest.revenue, priorMonth.revenue)
    const lab = pctDelta(latest.labor, priorMonth.labor)
    const res = pctDelta(latest.result, priorMonth.result)
    if (rev != null && lab != null && Math.sign(rev) !== Math.sign(lab) && Math.abs(rev) >= 3 && Math.abs(lab) >= 3) {
      bullets.push(
        `Revenue ${dirWord(rev)} ${Math.abs(rev).toFixed(0)}% vs ${priorMonth.label}, but staff costs ${dirWord(lab)} ${Math.abs(lab).toFixed(0)}% — cost and sales moved apart.`,
      )
    } else if (rev != null && Math.abs(rev) >= 5) {
      bullets.push(`Revenue ${dirWord(rev)} ${Math.abs(rev).toFixed(0)}% vs ${priorMonth.label}.`)
    }
    if (res != null && Math.abs(res) >= 15) {
      bullets.push(
        `Net result ${dirWord(res)} ${Math.abs(res).toFixed(0)}% vs ${priorMonth.label} (${formatAccountingPnlCompact(priorMonth.result)} → ${formatAccountingPnlCompact(latest.result)}).`,
      )
    }
  }

  if (latestStaff && priorStaff && priorMonth) {
    const head = pctDelta(latestStaff.staff_count, priorStaff.staff_count)
    const lab = pctDelta(latest.labor, priorMonth.labor)
    if (head != null && lab != null && Math.sign(head) !== Math.sign(lab) && Math.abs(head) >= 3 && Math.abs(lab) >= 3) {
      bullets.push(
        `Active staff ${dirWord(head)} ${Math.abs(head).toFixed(0)}% (${priorStaff.staff_count} → ${latestStaff.staff_count}) while staff costs ${dirWord(lab)} ${Math.abs(lab).toFixed(0)}%.`,
      )
    } else if (head != null && Math.abs(head) >= 5) {
      bullets.push(
        `Active staff ${dirWord(head)} ${Math.abs(head).toFixed(0)}% vs ${priorMonth.label} (${priorStaff.staff_count} → ${latestStaff.staff_count}).`,
      )
    }
  }

  if (priorYearSame && latest.labor_pct != null && priorYearSame.labor_pct != null) {
    const pp = round2(latest.labor_pct - priorYearSame.labor_pct)
    if (Math.abs(pp) >= 2) {
      bullets.push(
        `Staff took a ${pp > 0 ? 'larger' : 'smaller'} slice of revenue vs ${priorYearSame.label} (${priorYearSame.labor_pct.toFixed(0)}% → ${latest.labor_pct.toFixed(0)}%).`,
      )
    }
  }

  if (bullets.length === 0) {
    bullets.push('Browse the full-history chart below for trend and seasonal overlays.')
  }

  return { headline, bullets: bullets.slice(0, 4) }
}

function buildSeasonal (seriesAsc: AccountingPnlAnalyticsPoint[]): AccountingPnlAnalyticsSeasonal[] {
  const byKey = new Map(seriesAsc.map((p) => [p.date, p]))
  const byYear = new Map<number, AccountingPnlAnalyticsPoint[]>()
  for (const p of seriesAsc) {
    const list = byYear.get(p.year) ?? []
    list.push(p)
    byYear.set(p.year, list)
  }
  function yearMedian (year: number): number {
    const vals = (byYear.get(year) ?? []).map((p) => p.revenue).filter((v) => v > 0).sort((a, b) => a - b)
    if (!vals.length) return 0
    const mid = Math.floor(vals.length / 2)
    return vals.length % 2 ? vals[mid]! : (vals[mid - 1]! + vals[mid]!) / 2
  }

  const recent = [...seriesAsc].reverse().slice(0, 6)
  const out: AccountingPnlAnalyticsSeasonal[] = []

  for (const cur of recent) {
    const prior = byKey.get(monthKey(cur.year - 1, cur.month))
    if (!prior) continue
    const revenue_pct = pctDelta(cur.revenue, prior.revenue)
    const month_label = ACCOUNTING_PNL_MONTH_LONG_LABELS[cur.month - 1] ?? cur.label
    const curMed = yearMedian(cur.year)
    const priorMed = yearMedian(prior.year)
    const curSoft = curMed > 0 && cur.revenue < curMed * 0.95
    const priorSoft = priorMed > 0 && prior.revenue < priorMed * 0.95

    let note = `${month_label}: ${formatAccountingPnlCompact(cur.revenue)} vs ${formatAccountingPnlCompact(prior.revenue)} in ${prior.year}`
    if (curSoft && priorSoft) {
      note += ' — soft vs each year’s median in both years (seasonal dip).'
    } else if (revenue_pct != null) {
      const abs = Math.abs(revenue_pct)
      if (abs < 5) note += ' — roughly in line with last year.'
      else note += ` (${dirWord(revenue_pct)} ${abs.toFixed(0)}% YoY).`
    }
    out.push({
      month: cur.month,
      month_label: month_label,
      current_year: cur.year,
      prior_year: prior.year,
      current_revenue: cur.revenue,
      prior_revenue: prior.revenue,
      revenue_pct,
      note,
    })
  }
  return out
}

async function loadStaffSeries (
  db: Db,
  venue: AccountingPnlAnalyticsVenue,
  series: AccountingPnlAnalyticsPoint[],
): Promise<AccountingPnlAnalyticsStaffPoint[]> {
  if (!series.length) return []

  /** Period-cache headcount/hours — last 18 sealed months keeps GET usable. */
  const staffWindow = series.slice(-18)
  const first = staffWindow[0]!
  const last = staffWindow[staffWindow.length - 1]!
  const startDate = `${first.date}-01`
  const endDate = lastDayOfMonth(last.year, last.month)
  const locationId = venue === 'combined' ? undefined : locationIdForVenue(venue)

  const rows = await fetchStaffDailyLaborRows(db, startDate, endDate, locationId)

  type Acc = {
    workers: Set<string>
    ft: Set<string>
    pt: Set<string>
    zzp: Set<string>
    hours: number
    hours_ft: number
    hours_pt: number
    hours_zzp: number
  }
  const byMonth = new Map<string, Acc>()
  for (const row of rows) {
    const key = row.date.slice(0, 7)
    const acc = byMonth.get(key) ?? {
      workers: new Set<string>(),
      ft: new Set<string>(),
      pt: new Set<string>(),
      zzp: new Set<string>(),
      hours: 0,
      hours_ft: 0,
      hours_pt: 0,
      hours_zzp: 0,
    }
    for (const id of row.workerIds) if (id) acc.workers.add(id)
    for (const id of row.contractWorkerIds.ft) if (id) acc.ft.add(id)
    for (const id of row.contractWorkerIds.pt) if (id) acc.pt.add(id)
    for (const id of row.contractWorkerIds.zzp) if (id) acc.zzp.add(id)
    acc.hours = round2(acc.hours + row.gewerkt_hours)
    acc.hours_ft = round2(acc.hours_ft + (row.byContract?.ft.gewerkt_hours ?? 0))
    acc.hours_pt = round2(acc.hours_pt + (row.byContract?.pt.gewerkt_hours ?? 0))
    acc.hours_zzp = round2(acc.hours_zzp + (row.byContract?.zzp.gewerkt_hours ?? 0))
    byMonth.set(key, acc)
  }

  return staffWindow.map((p) => {
    const acc = byMonth.get(p.date)
    return {
      date: p.date,
      staff_count: acc?.workers.size ?? 0,
      ft: acc?.ft.size ?? 0,
      pt: acc?.pt.size ?? 0,
      zzp: acc?.zzp.size ?? 0,
      hours: acc?.hours ?? 0,
      hours_ft: acc?.hours_ft ?? 0,
      hours_pt: acc?.hours_pt ?? 0,
      hours_zzp: acc?.hours_zzp ?? 0,
    }
  })
}

/** Lazy Staff metric — period-cache active headcount FT/PT/ZZP. */
export async function buildPnlAnalyticsStaff (
  db: Db,
  venue: AccountingPnlAnalyticsVenue = 'combined',
): Promise<{ venue: AccountingPnlAnalyticsVenue; staff_series: AccountingPnlAnalyticsStaffPoint[] }> {
  const docs = await fetchSealedMonthlyPnlRows(db, { limit: null })
  const series = [...docs]
    .reverse()
    .map((doc) => {
      const row = venue === 'combined' ? doc.combined : doc.venues[venue]
      return pointFromRow(doc.year, doc.month, row)
    })
  return { venue, staff_series: await loadStaffSeries(db, venue, series) }
}

export async function buildPnlAnalytics (
  db: Db,
  venue: AccountingPnlAnalyticsVenue = 'combined',
): Promise<AccountingPnlAnalyticsDto> {
  const docs = await fetchSealedMonthlyPnlRows(db, { limit: null })
  const seriesDesc = docs.map((doc) => {
    const row = venue === 'combined' ? doc.combined : doc.venues[venue]
    return pointFromRow(doc.year, doc.month, row)
  })
  const series = [...seriesDesc].reverse()

  const latest = seriesDesc[0] ?? null
  const prior_month = seriesDesc[1] ?? null
  const prior_year_same_month = latest
    ? seriesDesc.find((p) => p.year === latest.year - 1 && p.month === latest.month) ?? null
    : null

  const first = series[0]
  const last = series[series.length - 1]
  const range_label = first && last
    ? first.date === last.date ? first.label : `${first.label} – ${last.label}`
    : 'No months'

  return {
    venue,
    range_label,
    month_count: series.length,
    series,
    staff_series: [],
    verdict: buildVerdict(latest, prior_month, prior_year_same_month, null, null),
    seasonal: buildSeasonal(series),
    latest,
    prior_month,
    prior_year_same_month,
  }
}
