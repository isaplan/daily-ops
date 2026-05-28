/**
 * @registry-id: dailyOpsSnapshotTypes
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-26T00:55:00.000Z
 * @description: Daily Ops Snapshot — master + section document shapes
 *   (revenue, labor). Written by dailyOpsSnapshotService, read by daily-ops API.
 * @last-fix: [2026-05-26] Added dedicated revenue-by-order-time snapshot section.
 *   Prior: [2026-05-26] Revenue sections can carry order-time hourly buckets alongside paid-time hourly buckets.
 *   Prior: [2026-05-25] Labor section stores Eitje hourly buckets for ADR-004 read paths.
 *
 * @architecture:
 *   - One master doc per (locationId, businessDate). Sections referenced by same key.
 *   - All numeric revenue fields carry ex_vat + inc_vat + vat (sourced from Bork V2
 *     line-level totals, see borkVatCalculation.ts).
 *   - All names denormalized at write time (locationName, teamName, userName) so
 *     reads never $lookup.
 *   - Business day = 08:00 → 07:59 next ISO day (Amsterdam). Eitje period == business_date
 *     directly (no shift starts in 00:00–07:59 window per ops pattern).
 *   - status indicates data completeness: `partial` while day is in-progress,
 *     `final` after next-morning 08:05 inbox sealing.
 *   - leadRevenueSource is decided once per snapshot (bork|inbox); inbox wins when the
 *     08:05 final report row exists for that businessDate+locationId.
 *
 * @exports-to:
 *   ✓ server/services/dailyOpsSnapshotService.ts (writer)
 *   ✓ server/utils/dailyOpsSnapshot/* (helpers)
 *   ✓ server/api/daily-ops/* (read endpoints — Phase A.3)
 */

export type SnapshotStatus = 'partial' | 'final'
export type LeadRevenueSource = 'bork' | 'inbox' | 'none'

/** Revenue breakdown with ex + inc + vat, no fixed divisor. */
export type RevenueBreakdown = {
  ex_vat: number
  inc_vat: number
  vat: number
}

/** Labor cost methodology pair: wages (hourly_rate × hours) and loaded (cost_per_hour × hours). */
export type LaborCostPair = {
  hours: number
  /** Σ hourly_rate × hours — gross wages */
  wage_cost: number
  /** Σ cost_per_hour × hours — loaded cost. Falls back to wage × 1.36 when cost_per_hour missing. */
  loaded_cost: number
  /** Number of source rows accumulated into this rollup. */
  record_count: number
}

/** Source provenance for debugging — copied to master.sources. */
export type SnapshotSourceFingerprint = {
  collection: string
  doc_count: number
  lastSyncAt?: Date | null
  /** Inbox-specific: which cron_hour produced these rows (8 = sealed, 15/18/23 = intraday). */
  cronHour?: number | null
}

/** Master KPI document — small, dashboard-headline-ready. */
export type DailyOpsSnapshotMaster = {
  _id?: unknown
  schema_version: 1
  /** ISO business-day date (08:00 boundary). */
  businessDate: string
  /** ObjectId string — unifiedLocationId from bork_unified_location_mapping. */
  locationId: string
  /** Denormalized — copied from locations at write time. */
  locationName: string

  status: SnapshotStatus
  leadRevenueSource: LeadRevenueSource

  /** Headline KPIs — computed by buildCards. */
  cards: {
    revenue: RevenueBreakdown
    labor: {
      wage_cost: number
      loaded_cost: number
      hours: number
    }
    productivity: {
      /** revenue.ex_vat / labor.hours (null if hours = 0) */
      revenue_per_hour: number | null
      /** labor.wage_cost / revenue.ex_vat (null if revenue = 0) */
      wage_cost_pct: number | null
      /** labor.loaded_cost / revenue.ex_vat (null if revenue = 0) */
      loaded_cost_pct: number | null
    }
  }

  /** Source provenance (debugging + rebuild decisions). */
  sources: {
    bork: SnapshotSourceFingerprint
    eitje: SnapshotSourceFingerprint
    inbox: SnapshotSourceFingerprint
  }

  /** Section presence flags — small markers, no payload. */
  sections: {
    revenue: boolean
    labor: boolean
    revenueHourly?: boolean
    revenueProducts?: boolean
    revenueTables?: boolean
    revenueWorkers?: boolean
    revenueByOrderTime?: boolean
  }

  lastBuiltAt: Date
  sealedAt?: Date | null
}

/** Revenue section — full hourly + period + intraday + lead-source resolution. */
export type DailyOpsSnapshotRevenueSection = {
  _id?: unknown
  schema_version: 1
  businessDate: string
  locationId: string
  locationName: string

  /** Source actually used for headline figures. */
  leadSource: LeadRevenueSource

  /** Daily totals (lead source wins; bork fallback when no inbox row). */
  totals: RevenueBreakdown & { quantity: number; record_count: number }

  /** Pre-filled 24-slot array indexed by business_hour 0..23 (0 = 08:00, 23 = 07:00 next day). */
  hourly: Array<{
    business_hour: number
    calendar_hour: number
    revenue: RevenueBreakdown
    quantity: number
  }>

  /** Same 24-slot shape, but bucketed by Bork order-entry time instead of paid/closed ticket time. */
  orderHourly?: Array<{
    business_hour: number
    calendar_hour: number
    revenue: RevenueBreakdown
    quantity: number
  }>

  /** Inbox basis snapshots captured at each poll for the day (intraday validators). */
  intraday: Array<{
    cron_hour: number
    received_at: Date
    revenue_ex_vat: number
    revenue_inc_vat: number
  }>

  /** Bork totals (always populated for cross-check). */
  borkTotals: RevenueBreakdown & { quantity: number; record_count: number }

  lastBuiltAt: Date
}

/** Labor section — team / contract / location / worker breakdowns with both cost methodologies. */
export type DailyOpsSnapshotLaborSection = {
  _id?: unknown
  schema_version: 1
  businessDate: string
  locationId: string
  locationName: string

  /** 2 = full Eitje labor (operational/gewerkt) written at snapshot build. Readers skip backfill when set. */
  laborBuildVersion?: number

  totals: LaborCostPair

  /** Gewerkte-only totals (Keuken + Bediening operational hours). */
  totals_gewerkt?: LaborCostPair

  /** Venue KPI / productivity shape — built from Eitje agg at snapshot write. */
  operational?: {
    gewerkt: LaborCostPair
    keuken: LaborCostPair
    bediening: LaborCostPair
  }

  /** Per-team rollup (e.g. Keuken, Bediening, Management). */
  teams: Array<
    LaborCostPair & {
      teamId: string
      teamName: string
      /** Gewerkte hours for this team (subset of hours). */
      gewerkt?: LaborCostPair
    }
  >

  /** Per-contract-type rollup (denormalized at snapshot build). */
  contracts?: Array<
    LaborCostPair & {
      contractType: string
    }
  >

  /** Eitje shift overlap by Amsterdam calendar hour; used for hourly productivity and interval P&L. */
  hourly?: Array<{
    calendar_hour: number
    hours: number
    loaded_cost: number
  }>

  /** Per-worker rollup. */
  workers: Array<
    LaborCostPair & {
      userId: string
      userName: string
      teamId: string
      teamName: string
      contractType?: string
      hourly_rate: number | null
      cost_per_hour: number | null
      /** True when loaded_cost used the 1.36 fallback (cost_per_hour missing). */
      loaded_cost_fallback: boolean
    }
  >

  lastBuiltAt: Date
}

/** Hourly revenue rollup (24 slots) — snapshot-first read for revenue dashboard. */
export type DailyOpsSnapshotRevenueHourlySection = {
  _id?: unknown
  schema_version: 1
  businessDate: string
  locationId: string
  locationName: string
  hourly: DailyOpsSnapshotRevenueSection['hourly']
  orderHourly?: DailyOpsSnapshotRevenueSection['hourly']
  lastBuiltAt: Date
}

/** Hourly revenue bucketed by Bork order-entry time (`Orders[].Time`). */
export type DailyOpsSnapshotRevenueByOrderTimeSection = {
  _id?: unknown
  schema_version: 1
  businessDate: string
  locationId: string
  locationName: string
  hourly: DailyOpsSnapshotRevenueSection['hourly']
  lastBuiltAt: Date
}

/** Top products + category totals for one business day. */
export type DailyOpsSnapshotRevenueProductsSection = {
  _id?: unknown
  schema_version: 1
  businessDate: string
  locationId: string
  locationName: string
  categories: Array<{ name: string; revenue_ex_vat: number; quantity: number }>
  products: Array<{ productId: string; productName: string; revenue_ex_vat: number; quantity: number }>
  lastBuiltAt: Date
}

/** Per-table revenue for one business day. */
export type DailyOpsSnapshotRevenueTablesSection = {
  _id?: unknown
  schema_version: 1
  businessDate: string
  locationId: string
  locationName: string
  tables: Array<{
    tableNum: string
    locationSpace: string
    revenue_ex_vat: number
    quantity: number
  }>
  lastBuiltAt: Date
}

/** Per-worker revenue for one business day. */
export type DailyOpsSnapshotRevenueWorkersSection = {
  _id?: unknown
  schema_version: 1
  businessDate: string
  locationId: string
  locationName: string
  workers: Array<{
    workerId: string
    workerName: string
    revenue_ex_vat: number
    quantity: number
    order_count: number
  }>
  lastBuiltAt: Date
}

/** Names of snapshot collections. Single source of truth — import from here. */
export const DAILY_OPS_SNAPSHOT_COLLECTIONS = {
  master: 'daily_ops_snapshot',
  revenueSection: 'daily_ops_snapshot_section_revenue',
  laborSection: 'daily_ops_snapshot_section_labor',
  revenueHourlySection: 'daily_ops_snapshot_section_revenue_hourly',
  revenueProductsSection: 'daily_ops_snapshot_section_products',
  revenueTablesSection: 'daily_ops_snapshot_section_tables',
  revenueWorkersSection: 'daily_ops_snapshot_section_workers',
  revenueByOrderTimeSection: 'daily_ops_snapshot_section_revenue_by_order_time',
  /** ADR-006 hot tier — precomputed 60d rolling KPI benchmarks. */
  revenueBenchmark: 'daily_ops_revenue_benchmark',
} as const
