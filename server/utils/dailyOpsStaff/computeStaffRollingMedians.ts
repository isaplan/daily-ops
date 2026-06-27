/**
 * @registry-id: dailyOpsStaffRollingMedians
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-06-26T14:00:00.000Z
 * @description: Period median + per-bucket rolling medians aligned to chart buckets
 * @last-fix: [2026-06-26] Rolling series per chart bucket + period median
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/api/daily-ops/staff/rolling-medians.get.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsStaffRollingMediansDto,
  DailyOpsStaffRollingSeriesPoint,
  DailyOpsStaffRollingWindow,
} from '~/types/daily-ops-staff'
import type { StaffChartGranularity } from '~/utils/dailyOpsStaffNav/modes'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { fetchStaffDailyLaborRows } from './fetchStaffDailyLabor'

type BucketRow = { date: string; endDate: string; hours: number; staff: number }

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

function percentile(nums: number[], p: number): number {
  const vals = nums.filter((n) => Number.isFinite(n))
  if (vals.length === 0) return 0
  const s = [...vals].sort((a, b) => a - b)
  const idx = (p / 100) * (s.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return s[lo]!
  return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo)
}

function bucketKey(date: string, granularity: StaffChartGranularity): string {
  const d = new Date(`${date}T12:00:00Z`)
  if (granularity === 'year') return String(d.getUTCFullYear())
  if (granularity === 'month') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function bucketEndDate(key: string, granularity: StaffChartGranularity): string {
  if (granularity === 'year') return `${key}-12-31`
  if (granularity === 'month') {
    const [ys, ms] = key.split('-')
    const y = Number(ys)
    const m = Number(ms)
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  }
  return addCalendarDaysYmd(key, 6)
}

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  while (cur <= end) {
    out.push(cur)
    cur = addCalendarDaysYmd(cur, 1)
  }
  return out
}

function enumerateBucketKeys(
  start: string,
  end: string,
  granularity: StaffChartGranularity,
): string[] {
  if (granularity === 'year') {
    const sy = Number(start.slice(0, 4))
    const ey = Number(end.slice(0, 4))
    return Array.from({ length: ey - sy + 1 }, (_, i) => String(sy + i))
  }
  if (granularity === 'month') {
    const out: string[] = []
    const d = new Date(`${start.slice(0, 7)}-01T12:00:00Z`)
    const endKey = end.slice(0, 7)
    while (true) {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      out.push(key)
      if (key >= endKey) break
      d.setUTCMonth(d.getUTCMonth() + 1)
    }
    return out
  }
  const out: string[] = []
  const endWeek = new Date(`${end}T12:00:00Z`)
  const endDay = endWeek.getUTCDay()
  const endMondayOffset = endDay === 0 ? -6 : 1 - endDay
  endWeek.setUTCDate(endWeek.getUTCDate() + endMondayOffset)
  for (let i = 51; i >= 0; i--) {
    const d = new Date(endWeek)
    d.setUTCDate(d.getUTCDate() - i * 7)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function buildOrderedBuckets(
  byDate: Map<string, { hours: number; staff: number }>,
  start: string,
  end: string,
  granularity: StaffChartGranularity,
): BucketRow[] {
  const map = new Map<string, { hours: number; staff: number }>()
  for (const date of enumerateDays(start, end)) {
    const v = byDate.get(date) ?? { hours: 0, staff: 0 }
    const key = bucketKey(date, granularity)
    const cur = map.get(key) ?? { hours: 0, staff: 0 }
    cur.hours = round2(cur.hours + v.hours)
    cur.staff = Math.max(cur.staff, v.staff)
    map.set(key, cur)
  }
  return enumerateBucketKeys(start, end, granularity).map((key) => ({
    date: key,
    endDate: bucketEndDate(key, granularity),
    hours: map.get(key)?.hours ?? 0,
    staff: map.get(key)?.staff ?? 0,
  }))
}

function buildWindowStats(
  label: string,
  buckets: Array<{ hours: number; staff: number }>,
  series: DailyOpsStaffRollingSeriesPoint[],
): DailyOpsStaffRollingWindow {
  const hours = buckets.map((b) => b.hours)
  const staff = buckets.map((b) => b.staff)
  const hoursMean = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0
  const staffMean = staff.length ? staff.reduce((a, b) => a + b, 0) / staff.length : 0
  return {
    label,
    hours: {
      median: round2(median(hours)),
      mean: round2(hoursMean),
      p25: round2(percentile(hours, 25)),
      p75: round2(percentile(hours, 75)),
    },
    staff_count: {
      median: round2(median(staff)),
      mean: round2(staffMean),
      p25: round2(percentile(staff, 25)),
      p75: round2(percentile(staff, 75)),
    },
    series,
  }
}

function rollingSeries(buckets: BucketRow[], days: number): DailyOpsStaffRollingSeriesPoint[] {
  return buckets.map((b) => {
    const windowStart = addCalendarDaysYmd(b.endDate, -(days - 1))
    const inWindow = buckets.filter((x) => x.endDate >= windowStart && x.endDate <= b.endDate)
    const hrs = inWindow.map((x) => x.hours)
    const stf = inWindow.map((x) => x.staff)
    return {
      date: b.date,
      hours: round2(median(hrs)),
      staff_count: round2(median(stf)),
    }
  })
}

function dailyMapFromRows(
  rows: Awaited<ReturnType<typeof fetchStaffDailyLaborRows>>,
): Map<string, { hours: number; staff: number }> {
  const byDate = new Map<string, { hours: number; staff: number }>()
  for (const row of rows) {
    const cur = byDate.get(row.date) ?? { hours: 0, staff: 0 }
    cur.hours = round2(cur.hours + row.gewerkt_hours)
    cur.staff = Math.max(cur.staff, row.staff_count)
    byDate.set(row.date, cur)
  }
  return byDate
}

export async function computeStaffRollingMedians(
  db: Db,
  opts: {
    startDate: string
    endDate?: string
    locationId?: string
    chartGranularity: StaffChartGranularity
  },
): Promise<DailyOpsStaffRollingMediansDto> {
  const endDate = opts.endDate || amsterdamOpenRegisterBusinessDateYmd()
  const chartRows = await fetchStaffDailyLaborRows(
    db,
    opts.startDate,
    endDate,
    opts.locationId,
  )
  const chartBuckets = buildOrderedBuckets(
    dailyMapFromRows(chartRows),
    opts.startDate,
    endDate,
    opts.chartGranularity,
  )

  const periodHours = chartBuckets.map((b) => b.hours)
  const periodStaff = chartBuckets.map((b) => b.staff)

  const windows = [30, 60, 90] as const
  const result: DailyOpsStaffRollingWindow[] = []

  for (const days of windows) {
    const trailStart = addCalendarDaysYmd(endDate, -(days - 1))
    const trailRows = await fetchStaffDailyLaborRows(
      db,
      trailStart,
      endDate,
      opts.locationId,
    )
    const trailBuckets = buildOrderedBuckets(
      dailyMapFromRows(trailRows),
      trailStart,
      endDate,
      opts.chartGranularity,
    )
    const nonEmpty = trailBuckets.filter((b) => b.hours > 0 || b.staff > 0)
    result.push(
      buildWindowStats(
        `${days}d`,
        nonEmpty.length ? nonEmpty : trailBuckets,
        rollingSeries(chartBuckets, days),
      ),
    )
  }

  return {
    periodMedian: {
      hours: round2(median(periodHours)),
      staff_count: round2(median(periodStaff)),
    },
    windows: result,
  }
}
