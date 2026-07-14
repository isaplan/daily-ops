/**
 * @registry-id: weeklyReportDocumentFreeze
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Freeze state for weekly report computed fields (14-day window)
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/weeklyReportDocument/upsertWeeklyReportDocument.ts
 */

import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { WEEKLY_REPORT_FREEZE_DAYS } from './constants'

export type WeeklyReportFreezeState = {
  isFrozen: boolean
  frozenAt: string | null
}

export function getFreezeState(weekEndDate: string, existingFrozenAt?: string | null): WeeklyReportFreezeState {
  if (existingFrozenAt) {
    return { isFrozen: true, frozenAt: existingFrozenAt }
  }
  const freezeOn = addCalendarDaysYmd(weekEndDate, WEEKLY_REPORT_FREEZE_DAYS)
  const today = new Date().toISOString().slice(0, 10)
  if (today >= freezeOn) {
    return { isFrozen: true, frozenAt: new Date().toISOString() }
  }
  return { isFrozen: false, frozenAt: null }
}
