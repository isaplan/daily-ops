/** Shared default date window for report pages (last N calendar days through today). */
export function getLastNDaysRange(days: number): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
   return {
    startDate: start.toISOString().split('T')[0] ?? '',
    endDate: end.toISOString().split('T')[0] ?? '',
  }
}

export function getLast30DaysRange(): { startDate: string; endDate: string } {
  return getLastNDaysRange(30)
}
