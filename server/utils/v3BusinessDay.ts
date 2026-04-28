/**
 * @registry-id: dailyOpsV3BusinessDay
 * @created: 2026-04-28T19:40:00.000Z
 * @last-modified: 2026-04-28T19:40:00.000Z
 * @description: Business day (06:00-05:59:59) utilities for V3 snapshots
 * @last-fix: [2026-04-28] Initial business day helpers
 * 
 * @exports-to:
 * ✓ server/services/v3Aggregation/v3AggregationOrchestrator.ts
 * ✓ server/services/v3Aggregation/v3SalesSnapshot.ts
 * ✓ server/services/v3Aggregation/v3LaborSnapshot.ts
 * ✓ server/utils/v3Snapshots.ts
 * 
 * @business-day-definition:
 * - Start: 06:00 UTC (calendar day A)
 * - End: 05:59:59 UTC (calendar day A+1)
 * - Part 1: 06:00-23:59 on day A
 * - Part 2: 00:00-05:59 on day A+1
 */

/**
 * Get the business date for a given timestamp
 * Business day runs 06:00 UTC to 05:59:59 UTC next day
 * 
 * Examples:
 * - 2026-04-26 05:00 UTC → businessDate = 2026-04-25
 * - 2026-04-26 06:00 UTC → businessDate = 2026-04-26
 * - 2026-04-26 23:00 UTC → businessDate = 2026-04-26
 * - 2026-04-27 00:00 UTC → businessDate = 2026-04-26 (still Part 2)
 * - 2026-04-27 05:59 UTC → businessDate = 2026-04-26 (still Part 2)
 */
export function getBusinessDate(date: Date = new Date()): string {
  const utcDate = new Date(date)
  const hour = utcDate.getUTCHours()
  
  // If hour is 0-5, we're in Part 2 of the previous business day
  if (hour < 6) {
    utcDate.setUTCDate(utcDate.getUTCDate() - 1)
  }
  
  return utcDate.toISOString().split('T')[0] ?? ''
}

/**
 * Get business day start (06:00 UTC on businessDate)
 */
export function getBusinessDayStart(businessDate: string): Date {
  const [year, month, day] = businessDate.split('-').map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 6, 0, 0, 0))
}

/**
 * Get business day end (05:59:59.999 UTC on next day)
 */
export function getBusinessDayEnd(businessDate: string): Date {
  const [year, month, day] = businessDate.split('-').map(Number)
  const endDate = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + 1, 5, 59, 59, 999))
  return endDate
}

/**
 * Get Part 1 ISO date (calendar day when business day starts)
 */
export function getBusinessDayPart1Date(businessDate: string): Date {
  const [year, month, day] = businessDate.split('-').map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0))
}

/**
 * Get Part 2 ISO date (next calendar day, 00:00 UTC)
 */
export function getBusinessDayPart2Date(businessDate: string): Date {
  const [year, month, day] = businessDate.split('-').map(Number)
  const part2Date = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + 1, 0, 0, 0, 0))
  return part2Date
}

/**
 * Determine which part of business day a timestamp falls into
 * Returns: 1 (06:00-23:59) or 2 (00:00-05:59)
 */
export function getBusinessDayPart(date: Date): 1 | 2 {
  const hour = date.getUTCHours()
  return hour >= 6 ? 1 : 2
}

/**
 * Check if current time indicates business day is finished
 * Business day finishes at 05:59:59 UTC and next day starts at 06:00 UTC
 */
export function isBusinessDayFinished(date: Date = new Date()): boolean {
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()
  
  // Business day finished when we reach 06:00 (next day's start)
  // Or at end of day (05:59+)
  return hour >= 6 || (hour === 5 && minute >= 59)
}

/**
 * Get ISO date string from Date object
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

/**
 * Format business date for display
 */
export function formatBusinessDate(businessDate: string): string {
  const date = new Date(`${businessDate}T00:00:00Z`)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Get current business date based on UTC time
 * Used for determining which snapshot to update
 */
export function getCurrentBusinessDate(): string {
  return getBusinessDate(new Date())
}

/**
 * Get hourly breakdown entry hour value
 * UTC hour (0-23)
 */
export function getHourFromDate(date: Date): number {
  return date.getUTCHours()
}

/**
 * Validate business date format (YYYY-MM-DD)
 */
export function isValidBusinessDateFormat(businessDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(businessDate)
}

/**
 * Get business day duration in milliseconds
 * Always 24 hours = 86,400,000 ms
 */
export function getBusinessDayDurationMs(): number {
  return 24 * 60 * 60 * 1000
}

/**
 * Calculate percentage of business day completed
 * Returns 0-100
 */
export function getBusinessDayProgressPercent(date: Date = new Date()): number {
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()
  const second = date.getUTCSeconds()
  
  const totalSeconds = (hour * 3600) + (minute * 60) + second
  const businessDaySeconds = 24 * 3600
  
  return Math.round((totalSeconds / businessDaySeconds) * 100)
}

/**
 * Get cron schedule timestamps for V3 aggregation
 * Returns array of hours when aggregation should run: [6, 13, 16, 18, 20, 22]
 */
export function getV3AggregationScheduleHours(): number[] {
  return [6, 13, 16, 18, 20, 22]
}

/**
 * Check if current UTC hour is a scheduled V3 aggregation time
 */
export function isScheduledAggregationTime(date: Date = new Date()): boolean {
  const hour = date.getUTCHours()
  return getV3AggregationScheduleHours().includes(hour)
}

/**
 * Get next scheduled aggregation time
 * Returns Date object for next scheduled run
 */
export function getNextAggregationTime(date: Date = new Date()): Date {
  const scheduleHours = getV3AggregationScheduleHours()
  const currentHour = date.getUTCHours()
  
  // Find next scheduled hour today
  const nextHourToday = scheduleHours.find(h => h > currentHour)
  if (nextHourToday !== undefined) {
    const next = new Date(date)
    next.setUTCHours(nextHourToday, 0, 0, 0)
    return next
  }
  
  // Next scheduled hour is tomorrow
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + 1)
  next.setUTCHours(scheduleHours[0] ?? 6, 0, 0, 0)
  return next
}
