/**
 * Daily Ops period resolver: converts period strings and anchors to UTC date ranges.
 * @registry-id: dailyOpsPeriod
 * @created: 2026-04-13T11:00:00.000Z
 * @last-modified: 2026-04-13T11:00:00.000Z
 * @description: Resolve daily-ops query period (today, yesterday, week, etc) to ISO date ranges
 * @last-fix: [2026-04-13] Created missing utility for server/utils auto-import
 * 
 * @exports-to:
 * ✓ server/utils/dailyOpsDashboardMetrics.ts => resolveDailyOpsPeriod() for metric context resolution
 */

import type { DailyOpsPeriodId } from '~/types/daily-ops-dashboard'

export type DailyOpsDateRange = {
  period: DailyOpsPeriodId
  startDate: string
  endDate: string
}

function padZero(n: number): string {
  return String(n).padStart(2, '0')
}

function dateToIso(date: Date): string {
  return `${date.getUTCFullYear()}-${padZero(date.getUTCMonth() + 1)}-${padZero(date.getUTCDate())}`
}

/**
 * Resolve a period string (e.g., 'today', 'this-week') to a UTC date range.
 * @param period - Period identifier ('today', 'yesterday', 'this-week', 'last-week')
 * @param anchor - Optional anchor date (YYYY-MM-DD) to calculate relative periods from. Defaults to today.
 * @returns Object with period, startDate, and endDate (all in YYYY-MM-DD UTC format)
 */
export function resolveDailyOpsPeriod(
  period: string | DailyOpsPeriodId,
  anchor?: string
): DailyOpsDateRange {
  // Parse anchor or use today as reference
  let reference: Date
  if (anchor) {
    const [y, m, d] = anchor.split('-').map(Number)
    reference = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  } else {
    reference = new Date()
    reference.setUTCHours(0, 0, 0, 0)
  }

  const dayOfWeek = reference.getUTCDay()

  switch (period) {
    case 'today': {
      const dateStr = dateToIso(reference)
      return {
        period: 'today',
        startDate: dateStr,
        endDate: dateStr,
      }
    }

    case 'yesterday': {
      const yesterday = new Date(reference)
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const dateStr = dateToIso(yesterday)
      return {
        period: 'yesterday',
        startDate: dateStr,
        endDate: dateStr,
      }
    }

    case 'this-week': {
      // Monday = 1, Sunday = 0; start from Monday of current week
      const startOfWeek = new Date(reference)
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - daysToMonday)
      return {
        period: 'this-week',
        startDate: dateToIso(startOfWeek),
        endDate: dateToIso(reference),
      }
    }

    case 'last-week': {
      // Get the Monday of last week
      const startOfLastWeek = new Date(reference)
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      startOfLastWeek.setUTCDate(startOfLastWeek.getUTCDate() - (daysToMonday + 7))
      
      // End of last week is Sunday (6 days after Monday)
      const endOfLastWeek = new Date(startOfLastWeek)
      endOfLastWeek.setUTCDate(endOfLastWeek.getUTCDate() + 6)
      
      return {
        period: 'last-week',
        startDate: dateToIso(startOfLastWeek),
        endDate: dateToIso(endOfLastWeek),
      }
    }

    default: {
      // Fallback: treat as 'today'
      const dateStr = dateToIso(reference)
      return {
        period: 'today',
        startDate: dateStr,
        endDate: dateStr,
      }
    }
  }
}
