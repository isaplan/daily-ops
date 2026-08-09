/**
 * @registry-id: opsNotificationTypes
 * @last-modified: 2026-08-09T01:05:00.000Z
 * @description: Ops notifications — data gaps, source drift, cron failures, ADR debt
 * @last-fix: [2026-08-09] period_cache_food_bev_regex_gap + PERIOD_CACHE_ADR L3
 * @adr-ref: ADR-004, ADR-021, PERIOD_CACHE_ADR L3
 *
 * @exports-to:
 * ✓ server/utils/opsNotifications/notificationItem.ts
 * ✓ server/utils/opsNotifications/detectors/periodCacheFoodBevGaps.ts
 */

/** Ops notifications — data gaps, source drift, cron failures, ADR/architecture debt. */

export type OpsNotificationSeverity = 'critical' | 'warning' | 'info'

export type OpsNotificationStatus = 'open' | 'fixed'

export type OpsNotificationCategory =
  | 'snapshot'
  | 'source'
  | 'cron'
  | 'integrity'
  | 'architecture'

export type OpsNotificationKind =
  // Snapshot (ADR-004)
  | 'missing_revenue_snapshot'
  | 'missing_labor_snapshot'
  | 'missing_master_snapshot'
  | 'revenue_snapshot_empty'
  | 'revenue_snapshot_stale_basis'
  | 'snapshot_venue_coverage_incomplete'
  // Source cross-check (Bork API vs Inbox Basis)
  | 'bork_inbox_revenue_gap'
  | 'missing_bork_when_inbox_final'
  | 'missing_inbox_when_bork_sales'
  // Cron / pipeline
  | 'inbox_morning_final_missing'
  | 'inbox_only_intraday_partial'
  | 'eitje_hours_inbox_missing'
  | 'gmail_oauth_invalid_grant'
  | 'unparsed_basis_attachment'
  | 'integration_sync_partial_failure'
  // Data integrity
  | 'unmapped_basis_location'
  | 'bork_revenue_aggregation_stale'
  | 'eitje_labor_aggregation_stale'
  | 'labor_snapshot_inconsistent'
  // Staff (ADR-009)
  | 'eitje_staff_not_in_members'
  | 'eitje_staff_missing_compensation'
  // Architecture / ADR / agent-rules
  | 'adr004_live_bork_on_revenue_get'
  | 'monolithic_module'
  | 'daily_ops_iso_calendar_misuse'
  // Period-cache food/bev (PERIOD_CACHE_ADR L3)
  | 'period_cache_food_bev_regex_gap'

export type OpsNotificationDto = {
  id: string
  category: OpsNotificationCategory
  kind: OpsNotificationKind
  severity: OpsNotificationSeverity
  status?: OpsNotificationStatus
  /** Set after manual Try fix (one attempt; no auto-retry on scan). */
  fixResultMessage?: string
  /** `system` for platform-wide issues */
  businessDate: string
  locationId: string
  locationName: string
  title: string
  message: string
  fixHint?: string
  solution?: string
  suggestedAction?: {
    action: string
    endpoint: string
    description: string
  }
  detectedAt: string
  /** Auto-hidden in default view (e.g. stale > 7 days). */
  hidden?: boolean
  hiddenReason?: string
  meta?: Record<string, unknown>
}

export type OpsNotificationsResponseDto = {
  scannedAt: string
  rangeStart: string
  rangeEnd: string
  total: number
  criticalCount: number
  warningCount: number
  hiddenCount?: number
  byCategory: Record<OpsNotificationCategory, number>
  items: OpsNotificationDto[]
}

export type OpsNotificationsCountDto = {
  total: number
  criticalCount: number
  warningCount: number
}
