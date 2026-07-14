/**
 * @registry-id: weeklyReportDocumentConstants
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Weekly reports collection + freeze window constants
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/weeklyReportDocument/*
 */

export const WEEKLY_REPORTS_COLLECTION = 'weekly_reports'

/** Days after week end before computed fields stop auto-refreshing. */
export const WEEKLY_REPORT_FREEZE_DAYS = 14
