import type { Db } from 'mongodb'
import type { DailyOpsRevenueQueryContext, DailyOpsRevenueRollingMediansDto } from '~/types/daily-ops-revenue'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { fetchRevenueRangeForDates } from './fetchRevenueRange'
import { eachBusinessDate } from './dateRange'

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

function percentile(nums: number[], p: number): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const idx = (p / 100) * (s.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return s[lo]!
  return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo)
}

async function dailyRevenues(
  db: Db,
  endDate: string,
  days: number,
  locationId?: string,
): Promise<number[]> {
  const start = addCalendarDaysYmd(endDate, -(days - 1))
  const out: number[] = []
  for (const date of eachBusinessDate(start, endDate)) {
    const t = await fetchRevenueRangeForDates(db, date, date, locationId)
    out.push(t.revenue)
  }
  return out
}

export async function computeRollingMedians(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueRollingMediansDto> {
  const endDate = ctx.endDate || amsterdamOpenRegisterBusinessDateYmd()
  const windows = [30, 60, 90] as const
  const result: DailyOpsRevenueRollingMediansDto['windows'] = []

  for (const days of windows) {
    const vals = await dailyRevenues(db, endDate, days, ctx.locationId)
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    result.push({
      label: `${days}d`,
      median: Math.round(median(vals) * 100) / 100,
      mean: Math.round(mean * 100) / 100,
      p25: Math.round(percentile(vals, 25) * 100) / 100,
      p75: Math.round(percentile(vals, 75) * 100) / 100,
    })
  }

  return { windows: result }
}
