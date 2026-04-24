import { amsterdamTodayYmd, amsterdamYmdForOffset } from '~/utils/inbox/importTableQuickDates'

/** Shared default date window for report pages (last ~N days through today, Europe/Amsterdam calendar). */
export function getLastNDaysRange(days: number): { startDate: string; endDate: string } {
  const anchor = new Date()
  return {
    startDate: amsterdamYmdForOffset(-days, anchor),
    endDate: amsterdamTodayYmd(anchor),
  }
}

export function getLast30DaysRange(): { startDate: string; endDate: string } {
  return getLastNDaysRange(30)
}

/** Last 30 Amsterdam calendar days ending yesterday (excludes partial “today”) — for Sales-V2 defaults. */
export function getLast30DaysEndingYesterday(anchor = new Date()): { startDate: string; endDate: string } {
  return {
    startDate: amsterdamYmdForOffset(-30, anchor),
    endDate: amsterdamYmdForOffset(-1, anchor),
  }
}
