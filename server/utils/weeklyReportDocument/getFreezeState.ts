/**
 * @registry-id: weeklyReportDocumentFreeze
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-17T00:30:00.000Z
 * @description: Freeze state for report computed fields (optional freeze-days override)
 * @last-fix: [2026-07-17] Optional freezeDays for monthly reports
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/weeklyReportDocument/upsertWeeklyReportDocument.ts
 * ✓ server/utils/monthlyReportDocument/upsertMonthlyReportDocument.ts
 */

import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { WEEKLY_REPORT_FREEZE_DAYS } from './constants'

export type WeeklyReportFreezeState = {
  isFrozen: boolean
  frozenAt: string | null
}

export function getFreezeState(
  periodEndDate: string,
  existingFrozenAt?: string | null,
  freezeDays: number = WEEKLY_REPORT_FREEZE_DAYS,
): WeeklyReportFreezeState {
  if (existingFrozenAt) {
    return { isFrozen: true, frozenAt: existingFrozenAt }
  }
  const freezeOn = addCalendarDaysYmd(periodEndDate, freezeDays)
  const today = new Date().toISOString().slice(0, 10)
  if (today >= freezeOn) {
    return { isFrozen: true, frozenAt: new Date().toISOString() }
  }
  return { isFrozen: false, frozenAt: null }
}
