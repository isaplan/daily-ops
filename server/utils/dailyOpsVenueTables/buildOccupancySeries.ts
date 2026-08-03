/**
 * @registry-id: dailyOpsBuildOccupancySeries
 * @created: 2026-07-22T00:00:00.000Z
 * @last-modified: 2026-07-28T14:40:00.000Z
 * @description: Build multi-grain occupancy series from per-day combined points (write-path)
 * @last-fix: [2026-07-28] Hour series keys match periodBreakdown bucketKey (unpadded)
 *   Prior: [2026-07-22] day / DOW / week / WOM / month / MOY / year grains
 * @adr-ref: ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueTables/buildTableOccupancySummary.ts
 * ✓ utils/dailyOpsPeriodBreakdownOccupancy.ts
 */

import type {
  DailyOpsOccupancyGrain,
  DailyOpsOccupancySeriesByGrain,
  DailyOpsOccupancySeriesPoint,
  DailyOpsTableOccupancyDayDto,
} from '../../../types/daily-ops-venue-tables'

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function getMonthKey(ymd: string): string {
  return ymd.slice(0, 7)
}

function getYearKey(ymd: string): string {
  return ymd.slice(0, 4)
}

function getIsoWeek(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  const thursday = new Date(date)
  thursday.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7))
  const year = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekNo = Math.ceil(((thursday.getTime() - jan4.getTime()) / 86400000 + jan4.getUTCDay() + 1) / 7)
  return `${year}-W${String(weekNo).padStart(2, '0')}`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null
  return round1(nums.reduce((s, n) => s + n, 0) / nums.length)
}

/** Collapse venue×day rows into one combined point per business date. */
export function combineDailyOccupancyPoints(
  daily: DailyOpsTableOccupancyDayDto[],
): DailyOpsOccupancySeriesPoint[] {
  const byDate = new Map<string, { actives: number[]; totals: number[]; pcts: number[] }>()
  for (const row of daily) {
    const cur = byDate.get(row.date) ?? { actives: [], totals: [], pcts: [] }
    cur.actives.push(row.activeTables)
    cur.totals.push(row.totalTables)
    if (row.occupancyPct != null) cur.pcts.push(row.occupancyPct)
    byDate.set(row.date, cur)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      key: date,
      label: date,
      activeTables: round1(v.actives.reduce((s, n) => s + n, 0)),
      totalTables: v.totals.reduce((s, n) => s + n, 0),
      occupancyPct: mean(v.pcts),
    }))
}

function weekOfMonth(ymd: string): number {
  const day = Number(ymd.slice(8, 10))
  return Math.min(5, Math.ceil(day / 7))
}

function bucketMean(
  buckets: Map<string, { label: string; actives: number[]; totals: number[]; pcts: number[] }>,
): DailyOpsOccupancySeriesPoint[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      label: v.label,
      activeTables: mean(v.actives) ?? 0,
      totalTables: v.totals.length ? Math.max(...v.totals) : 0,
      occupancyPct: mean(v.pcts),
    }))
}

function pushBucket(
  map: Map<string, { label: string; actives: number[]; totals: number[]; pcts: number[] }>,
  key: string,
  label: string,
  p: DailyOpsOccupancySeriesPoint,
): void {
  const cur = map.get(key) ?? { label, actives: [], totals: [], pcts: [] }
  cur.actives.push(p.activeTables)
  cur.totals.push(p.totalTables)
  if (p.occupancyPct != null) cur.pcts.push(p.occupancyPct)
  map.set(key, cur)
}

export function buildOccupancySeriesByGrain(
  dayPoints: DailyOpsOccupancySeriesPoint[],
): DailyOpsOccupancySeriesByGrain {
  const dow = new Map<string, { label: string; actives: number[]; totals: number[]; pcts: number[] }>()
  const week = new Map<string, { label: string; actives: number[]; totals: number[]; pcts: number[] }>()
  const wom = new Map<string, { label: string; actives: number[]; totals: number[]; pcts: number[] }>()
  const month = new Map<string, { label: string; actives: number[]; totals: number[]; pcts: number[] }>()
  const moy = new Map<string, { label: string; actives: number[]; totals: number[]; pcts: number[] }>()
  const year = new Map<string, { label: string; actives: number[]; totals: number[]; pcts: number[] }>()

  for (const p of dayPoints) {
    const d = new Date(`${p.key}T12:00:00Z`)
    const dowIdx = d.getUTCDay()
    pushBucket(dow, String(dowIdx), DOW_LABELS[dowIdx]!, p)

    const wk = getIsoWeek(p.key)
    pushBucket(week, wk, wk, p)

    const womN = weekOfMonth(p.key)
    pushBucket(wom, `W${womN}`, `Week ${womN} of month`, p)

    const mk = getMonthKey(p.key)
    pushBucket(month, mk, mk, p)

    const mo = Number(p.key.slice(5, 7)) - 1
    pushBucket(moy, String(mo + 1).padStart(2, '0'), MONTH_LABELS[mo]!, p)

    const yk = getYearKey(p.key)
    pushBucket(year, yk, yk, p)
  }

  return {
    day: dayPoints,
    dayOfWeek: bucketMean(dow),
    week: bucketMean(week),
    weekOfMonth: bucketMean(wom),
    month: bucketMean(month),
    monthOfYear: bucketMean(moy),
    year: bucketMean(year),
    hour: [],
  }
}

/** Estimate hourly occupancy from day totals × hourly revenue share.
 * @deprecated Prefer sealed tablesByHour → buildTableOccupancySummary.hourly / series.hour.
 */
export function buildHourOccupancySeriesFromRevenue(
  dayActive: number,
  dayTotal: number,
  dayPct: number | null,
  hourly: { calendarHour: number; hourLabel: string; revenue: number }[],
): DailyOpsOccupancySeriesPoint[] {
  const dayRev = hourly.reduce((s, h) => s + h.revenue, 0)
  return hourly
    .slice()
    .sort((a, b) => a.calendarHour - b.calendarHour)
    .map((h) => {
      const share = dayRev > 0 ? h.revenue / dayRev : 0
      const activeTables = round1(dayActive * share)
      const occupancyPct =
        dayTotal > 0 ? Math.round((activeTables / dayTotal) * 1000) / 10 : dayPct
      return {
        key: String(h.calendarHour),
        label: h.hourLabel,
        activeTables,
        totalTables: dayTotal,
        occupancyPct: h.revenue > 0 ? occupancyPct : null,
      }
    })
}

export const OCCUPANCY_GRAIN_ORDER: DailyOpsOccupancyGrain[] = [
  'hour',
  'day',
  'dayOfWeek',
  'week',
  'weekOfMonth',
  'month',
  'monthOfYear',
  'year',
]
