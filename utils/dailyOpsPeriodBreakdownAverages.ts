import type { PeriodBreakdownGranularity } from '~/types/daily-ops-dashboard'
import { chartTrendSeries, type StaffTrendResult } from '~/utils/dailyOpsStaffChartMedians'

function sortMetricRows(rows: Array<{ date: string; value: number }>) {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date, undefined, { numeric: true }))
}

/** Hour overlay history — rolling 3h/6h/12h needs multi-day hour buckets. */
export const PERIOD_HOUR_OVERLAY_LOOKBACK_DAYS = 7

/** Recent buckets for trend regression (median uses full history series). */
export const PERIOD_TREND_BUCKETS: Record<PeriodBreakdownGranularity, number> = {
  hour: 8,
  day: 21,
  week: 12,
  month: 12,
}

/** Rolling median window sizes (bucket count) per granularity. */
export const PERIOD_ROLLING_BUCKETS: Record<PeriodBreakdownGranularity, number[]> = {
  hour: [3, 6, 12],
  day: [7, 14, 21],
  week: [4, 8, 12],
  month: [3, 6, 12],
}

export function periodTrendWindowLabel(granularity: PeriodBreakdownGranularity): string {
  const n = PERIOD_TREND_BUCKETS[granularity]
  switch (granularity) {
    case 'hour':
      return `last ${n} hrs`
    case 'day':
      return `last ${n} days`
    case 'week':
      return `last ${n} wks`
    case 'month':
      return `last ${n} mo`
  }
}

export function periodRollingWindowLabel(
  granularity: PeriodBreakdownGranularity,
  buckets: number,
): string {
  const unit =
    granularity === 'hour' ? 'hr' : granularity === 'day' ? 'd' : granularity === 'week' ? 'wk' : 'mo'
  return `${buckets}${unit}`
}

function median(nums: number[]): number {
  const vals = nums.filter((n) => Number.isFinite(n))
  if (vals.length === 0) return 0
  const s = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Fit on last N composite hour keys (multi-day), project onto today's hour x-axis. */
export function chartHourTrendProjected(
  visibleHourRows: Array<{ date: string; value: number }>,
  history: Array<{ date: string; value: number }>,
  businessDate: string,
  trendBuckets: number,
): StaffTrendResult {
  const sortedHistory = sortMetricRows(history)
  const trendWindow = sortedHistory.slice(-trendBuckets)
  const fit = chartTrendSeries(trendWindow)
  if (fit.points.length < 2 || !visibleHourRows.length) {
    return { points: [], slopePerBucket: fit.slopePerBucket, sampleCount: fit.sampleCount }
  }

  const windowSorted = sortMetricRows(trendWindow).filter((r) => r.value > 0)
  const anchorDate = windowSorted[0]?.date
  if (!anchorDate) {
    return { points: [], slopePerBucket: fit.slopePerBucket, sampleCount: fit.sampleCount }
  }

  const anchorGlobalIdx = sortedHistory.findIndex((r) => r.date === anchorDate)
  const anchorFitValue = fit.points[0]!.value
  const prefix = `${businessDate}T`

  const points = sortMetricRows(visibleHourRows).map((row) => {
    const composite = `${prefix}${row.date}`
    const globalIdx = sortedHistory.findIndex((r) => r.date === composite)
    if (globalIdx < 0) return { date: row.date, value: 0 }
    const value = Math.round((anchorFitValue + fit.slopePerBucket * (globalIdx - anchorGlobalIdx)) * 100) / 100
    return { date: row.date, value }
  })

  return {
    points: points.filter((p) => p.value > 0),
    slopePerBucket: fit.slopePerBucket,
    sampleCount: fit.sampleCount,
  }
}

export function chartRollingMedianByBuckets(
  rows: Array<{ date: string; value: number }>,
  windowBuckets: number,
): Array<{ date: string; value: number }> {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date, undefined, { numeric: true }))
  return sorted.map((_, i) => {
    const slice = sorted.slice(Math.max(0, i - windowBuckets + 1), i + 1)
    const vals = slice.map((x) => x.value).filter((v) => v > 0)
    const value = Math.round(median(vals.length ? vals : slice.map((x) => x.value)) * 100) / 100
    return { date: sorted[i]!.date, value }
  })
}
