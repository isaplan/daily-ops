import type { Db } from 'mongodb'
import type { DailyOpsWeekdayPatternRow } from '~/types/daily-ops-revenue'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { fetchRevenueRangeForDates } from './fetchRevenueRange'

const DOW_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

function dowIndex(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()
}

export async function computeWeekdayPattern(
  db: Db,
  weekday: string,
  endDate: string,
  locationId?: string,
  compareEndDate?: string,
): Promise<DailyOpsWeekdayPatternRow[]> {
  const targetDow = DOW_NAMES.indexOf(weekday.toLowerCase() as (typeof DOW_NAMES)[number])
  if (targetDow < 0) return []

  const rows: DailyOpsWeekdayPatternRow[] = []
  let cursor = endDate
  let found = 0
  while (found < 10 && cursor >= '2020-01-01') {
    if (dowIndex(cursor) === targetDow) {
      const t = await fetchRevenueRangeForDates(db, cursor, cursor, locationId)
      const row: DailyOpsWeekdayPatternRow = {
        date: cursor,
        dayOfWeek: weekday,
        revenue: Math.round(t.revenue * 100) / 100,
        itemsCount: t.itemsCount,
      }
      if (compareEndDate) {
        const cmpDate = addCalendarDaysYmd(cursor, -365)
        const cmp = await fetchRevenueRangeForDates(db, cmpDate, cmpDate, locationId)
        row.compareRevenue = Math.round(cmp.revenue * 100) / 100
        row.comparePct =
          cmp.revenue > 0 ? Math.round(((t.revenue - cmp.revenue) / cmp.revenue) * 10000) / 100 : null
      }
      rows.push(row)
      found++
    }
    cursor = addCalendarDaysYmd(cursor, -1)
  }

  return rows.reverse()
}
