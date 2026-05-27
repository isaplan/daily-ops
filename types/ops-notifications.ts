/** Ops notifications — data gaps, source drift, cron failures, ADR/architecture debt. */

export type OpsNotificationSeverity = 'critical' | 'warning' | 'info'

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
  // Source cross-check (Bork API vs Inbox Basis)
  | 'bork_inbox_revenue_gap'
  | 'missing_bork_when_inbox_final'
  | 'missing_inbox_when_bork_sales'
  // Cron / pipeline
  | 'inbox_morning_final_missing'
  | 'inbox_only_intraday_partial'
  | 'eitje_hours_inbox_missing'
  // Data integrity
  | 'unmapped_basis_location'
  | 'bork_revenue_aggregation_stale'
  | 'eitje_labor_aggregation_stale'
  | 'labor_snapshot_inconsistent'
  // Architecture / ADR / agent-rules
  | 'adr004_live_bork_on_revenue_get'
  | 'monolithic_module'

export type OpsNotificationDto = {
  id: string
  category: OpsNotificationCategory
  kind: OpsNotificationKind
  severity: OpsNotificationSeverity
  /** `system` for platform-wide issues */
  businessDate: string
  locationId: string
  locationName: string
  title: string
  message: string
  fixHint: string
  detectedAt: string
  meta?: Record<string, unknown>
}

export type OpsNotificationsResponseDto = {
  scannedAt: string
  rangeStart: string
  rangeEnd: string
  total: number
  criticalCount: number
  warningCount: number
  byCategory: Record<OpsNotificationCategory, number>
  items: OpsNotificationDto[]
}

export type OpsNotificationsCountDto = {
  total: number
  criticalCount: number
  warningCount: number
}
