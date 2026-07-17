/**
 * @registry-id: monthlyReportDocumentConstants
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T00:30:00.000Z
 * @description: Monthly reports collection + freeze window constants
 * @last-fix: [2026-07-17] Freeze days wired via upsertMonthlyReportDocument
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/monthlyReportDocument/*
 */

export const MONTHLY_REPORTS_COLLECTION = 'monthly_reports'

/** Days after month end before computed fields stop auto-refreshing. */
export const MONTHLY_REPORT_FREEZE_DAYS = 14
