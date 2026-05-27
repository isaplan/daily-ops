import type {
  OpsNotificationCategory,
  OpsNotificationDto,
  OpsNotificationKind,
  OpsNotificationSeverity,
} from '~/types/ops-notifications'

const TITLES: Record<OpsNotificationKind, string> = {
  missing_revenue_snapshot: 'Revenue snapshot missing',
  missing_labor_snapshot: 'Labor snapshot missing',
  missing_master_snapshot: 'Master snapshot missing',
  revenue_snapshot_empty: 'Revenue snapshot empty',
  revenue_snapshot_stale_basis: 'Revenue snapshot wrong Basis row',
  bork_inbox_revenue_gap: 'Bork API vs Inbox gap',
  missing_bork_when_inbox_final: 'Bork API missing (Inbox has final)',
  missing_inbox_when_bork_sales: 'Inbox final missing (Bork has sales)',
  inbox_morning_final_missing: 'Morning Basis email missing',
  inbox_only_intraday_partial: 'Only intraday Basis (no final)',
  eitje_hours_inbox_missing: 'Eitje hours inbox missing',
  unmapped_basis_location: 'Unmapped Basis location',
  bork_revenue_aggregation_stale: 'Bork revenue aggregation stale',
  eitje_labor_aggregation_stale: 'Eitje labor aggregation stale',
  labor_snapshot_inconsistent: 'Labor snapshot internally inconsistent',
  adr004_live_bork_on_revenue_get: 'ADR-004 violation on GET',
  monolithic_module: 'Monolithic module',
}

const SEVERITY: Record<OpsNotificationKind, OpsNotificationSeverity> = {
  missing_revenue_snapshot: 'critical',
  missing_labor_snapshot: 'critical',
  revenue_snapshot_stale_basis: 'critical',
  bork_inbox_revenue_gap: 'critical',
  missing_bork_when_inbox_final: 'warning',
  missing_inbox_when_bork_sales: 'critical',
  inbox_morning_final_missing: 'critical',
  inbox_only_intraday_partial: 'warning',
  eitje_hours_inbox_missing: 'warning',
  unmapped_basis_location: 'warning',
  bork_revenue_aggregation_stale: 'critical',
  eitje_labor_aggregation_stale: 'critical',
  labor_snapshot_inconsistent: 'critical',
  missing_master_snapshot: 'warning',
  revenue_snapshot_empty: 'warning',
  adr004_live_bork_on_revenue_get: 'critical',
  monolithic_module: 'info',
}

const CATEGORY: Record<OpsNotificationKind, OpsNotificationCategory> = {
  missing_revenue_snapshot: 'snapshot',
  missing_labor_snapshot: 'snapshot',
  missing_master_snapshot: 'snapshot',
  revenue_snapshot_empty: 'snapshot',
  revenue_snapshot_stale_basis: 'snapshot',
  bork_inbox_revenue_gap: 'source',
  missing_bork_when_inbox_final: 'source',
  missing_inbox_when_bork_sales: 'source',
  inbox_morning_final_missing: 'cron',
  inbox_only_intraday_partial: 'cron',
  eitje_hours_inbox_missing: 'cron',
  unmapped_basis_location: 'integrity',
  bork_revenue_aggregation_stale: 'integrity',
  eitje_labor_aggregation_stale: 'integrity',
  labor_snapshot_inconsistent: 'integrity',
  adr004_live_bork_on_revenue_get: 'architecture',
  monolithic_module: 'architecture',
}

export function buildNotificationItem(input: {
  kind: OpsNotificationKind
  businessDate: string
  locationId: string
  locationName: string
  message: string
  fixHint: string
  severity?: OpsNotificationSeverity
  meta?: Record<string, unknown>
}): OpsNotificationDto {
  const kind = input.kind
  return {
    id: `${kind}:${input.businessDate}:${input.locationId}`,
    category: CATEGORY[kind],
    kind,
    severity: input.severity ?? SEVERITY[kind],
    businessDate: input.businessDate,
    locationId: input.locationId,
    locationName: input.locationName,
    title: TITLES[kind],
    message: input.message,
    fixHint: input.fixHint,
    detectedAt: new Date().toISOString(),
    meta: input.meta,
  }
}

export function countByCategory(items: OpsNotificationDto[]): Record<OpsNotificationCategory, number> {
  const out: Record<OpsNotificationCategory, number> = {
    snapshot: 0,
    source: 0,
    cron: 0,
    integrity: 0,
    architecture: 0,
  }
  for (const i of items) out[i.category]++
  return out
}

export function sortNotifications(items: OpsNotificationDto[]): OpsNotificationDto[] {
  const sev = { critical: 0, warning: 1, info: 2 }
  return [...items].sort((a, b) => {
    const sd = sev[a.severity] - sev[b.severity]
    if (sd !== 0) return sd
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    if (a.businessDate !== b.businessDate) return b.businessDate.localeCompare(a.businessDate)
    return (a.locationName ?? '').localeCompare(b.locationName ?? '')
  })
}
