import type { DailyOpsStaffTimeseriesPoint } from '~/types/daily-ops-staff'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import type { StaffChartGranularity } from '~/utils/dailyOpsStaffNav/modes'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function median(nums: number[]): number {
  const vals = nums.filter((n) => Number.isFinite(n))
  if (vals.length === 0) return 0
  const s = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

function bucketEndDate(key: string, granularity: StaffChartGranularity): string {
  if (granularity === 'year') return `${key}-12-31`
  if (granularity === 'month') {
    const [ys, ms] = key.split('-')
    return new Date(Date.UTC(Number(ys), Number(ms), 0)).toISOString().slice(0, 10)
  }
  return addCalendarDaysYmd(key, 6)
}

function metricValue(p: DailyOpsStaffTimeseriesPoint, metric: 'hours' | 'staff'): number {
  return metric === 'hours' ? p.gewerkt_hours : p.staff_count
}

export type StaffPeriodMedianResult = {
  median: number
  sampleCount: number
  fromDate: string | null
  toDate: string | null
}

export function staffPeriodMedian(
  points: DailyOpsStaffTimeseriesPoint[],
  metric: 'hours' | 'staff',
): StaffPeriodMedianResult {
  const rows = [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({ date: p.date, value: metricValue(p, metric) }))
    .filter((r) => r.value > 0)

  if (!rows.length) {
    return { median: 0, sampleCount: 0, fromDate: null, toDate: null }
  }

  return {
    median: round2(median(rows.map((r) => r.value))),
    sampleCount: rows.length,
    fromDate: rows[0]!.date,
    toDate: rows[rows.length - 1]!.date,
  }
}

export function staffRollingMedianSeries(
  points: DailyOpsStaffTimeseriesPoint[],
  granularity: StaffChartGranularity,
  windowDays: number,
  metric: 'hours' | 'staff',
): Array<{ date: string; value: number }> {
  const buckets = [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      date: p.date,
      endDate: bucketEndDate(p.date, granularity),
      value: metricValue(p, metric),
    }))

  return buckets.map((b) => {
    const windowStart = addCalendarDaysYmd(b.endDate, -(windowDays - 1))
    const inWindow = buckets.filter((x) => x.endDate >= windowStart && x.endDate <= b.endDate)
    const vals = inWindow.map((x) => x.value).filter((v) => v > 0)
    return {
      date: b.date,
      value: round2(median(vals.length ? vals : inWindow.map((x) => x.value))),
    }
  })
}

export type StaffTrendResult = {
  points: Array<{ date: string; value: number }>
  slopePerBucket: number
  sampleCount: number
}

/** Linear trend over all non-zero buckets in the chart range (long window). */
export function staffTrendSeries(
  points: DailyOpsStaffTimeseriesPoint[],
  metric: 'hours' | 'staff',
): StaffTrendResult {
  const rows = [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({ date: p.date, value: metricValue(p, metric) }))
    .filter((r) => r.value > 0)

  if (rows.length < 2) {
    return {
      points: rows.map((r) => ({ date: r.date, value: r.value })),
      slopePerBucket: 0,
      sampleCount: rows.length,
    }
  }

  const n = rows.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    const x = i
    const y = rows[i]!.value
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }
  const denom = n * sumXX - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  return {
    points: rows.map((r, i) => ({
      date: r.date,
      value: round2(intercept + slope * i),
    })),
    slopePerBucket: round2(slope),
    sampleCount: n,
  }
}

/** Short windows (calendar days) — ~4 / 8 / 13 weeks on weekly charts. */
export const STAFF_ROLLING_WINDOW_DAYS: Record<string, number> = {
  '30d': 30,
  '60d': 60,
  '90d': 90,
}

export const STAFF_REFERENCE_WINDOWS = {
  trend: {
    weekly: '52 weeks',
    monthly: '12 months',
    yearly: 'all years',
  },
  median: {
    weekly: '52 weeks',
    monthly: '12 months',
    yearly: 'all years',
  },
  rolling: {
    '30d': '~4 weeks',
    '60d': '~8 weeks',
    '90d': '~13 weeks',
  },
} as const
