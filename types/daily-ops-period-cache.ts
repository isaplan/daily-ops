/**
 * @registry-id: dailyOpsPeriodCacheTypes
 * @created: 2026-08-08T21:20:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Unified period-cache node + ratio snapshot shapes
 * @last-fix: [2026-08-09] Add day-level byWorker / byTable revenue rows
 * @adr-ref: PERIOD_CACHE_ADR L1, L2
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsPeriodCache/store.ts
 * ✓ server/utils/dailyOpsPeriodCache/buildDayNode.ts
 * ✓ server/utils/dailyOpsPeriodCache/cascadePeriod.ts
 * ✓ server/utils/dailyOpsPeriodCache/ratioSnapshot.ts
 * ✓ server/utils/dailyOpsPeriodCache/resolvePeriodRange.ts
 * ✓ scripts/backfill-period-cache.ts
 * ✓ scripts/validate-period-cache.ts
 */

export type DailyOpsPeriodLevel = 'day' | 'week' | 'month' | 'year'

/** Lifecycle of a period node (write-time sealing). */
export type DailyOpsPeriodStatus =
  | 'open'
  | 'ops_sealed'
  | 'finance_sealed'
  | 'partial'

export type PeriodLeadRevenueSource =
  | 'live_bork'
  | 'inbox_digest'
  | 'finance_pnl'
  | 'none'

export type PeriodRatioSource =
  | 'finance_sealed'
  | 'rolling_12m'
  | 'blended'
  | 'default'

export type PeriodCategoryRow = {
  name: string
  exVat: number
  qty: number
}

export type PeriodProductRow = {
  productId: string
  name: string
  exVat: number
  qty: number
}

export type PeriodHourRow = {
  hour: number
  exVat: number
  qty: number
}

/** Day-level per-worker Bork revenue (from snapshot workers section). */
export type PeriodWorkerRevenueRow = {
  workerId: string
  workerName: string
  exVat: number
  qty: number
  orderCount: number
}

/** Day-level per-table revenue (from snapshot tables section). */
export type PeriodTableRevenueRow = {
  tableNum: string
  locationSpace: string
  exVat: number
  qty: number
}

export type PeriodTeamLaborRow = {
  team: string
  hours: number
  loadedCost: number
}

export type PeriodStaffWorkerRow = {
  memberId: string
  hours: number
  wage: number
  team: string
  sick?: boolean
  leave?: boolean
}

export type PeriodRevenueBlock = {
  exVat: number
  incVat: number
  vat: number
  food: number
  beverage: number
  /** Day-level detail; empty on week/month/year. */
  byCategory: PeriodCategoryRow[]
  /** Day-level top products; empty on rollups. */
  byProductTop: PeriodProductRow[]
  /** Day-level hourly; omitted/empty on rollups. */
  byHour: PeriodHourRow[]
  /** Day-level worker revenue; omitted/empty on rollups. */
  byWorker?: PeriodWorkerRevenueRow[]
  /** Day-level table revenue; omitted/empty on rollups. */
  byTable?: PeriodTableRevenueRow[]
  leadSource: PeriodLeadRevenueSource
}

export type PeriodLaborBlock = {
  hours: number
  wageCost: number
  loadedCost: number
  byTeam: PeriodTeamLaborRow[]
  staffCount: number
}

export type PeriodStaffBlock = {
  /** Day-level only in Phase 1 (may be empty). */
  workers: PeriodStaffWorkerRow[]
}

export type PeriodCogsBlock = {
  foodPct: number
  bevPct: number
  amount: number
}

export type PeriodRatiosBlock = {
  laborPct: number
  fixedLaborPct: number
  flexLaborPct: number
  cogsPct: number
  breakEven: number
  netProfit: number
  source: PeriodRatioSource
  /** Which ratio snapshot monthKey / id this node used. */
  ratioAsOf: string
}

export type PeriodProvenance = {
  builtFrom: string[]
  lastBuiltAt: string
  snapshotVersion: number
  /** Products that hit regex name-match fallback (data gaps). */
  regexFallbackProductIds?: string[]
}

/**
 * One prebuilt JSON node for a venue (or `all`) × period level × key.
 * Unique key: { locationId, level, periodKey }.
 */
export type DailyOpsPeriodNode = {
  schemaVersion: 1
  locationId: string
  locationName: string
  level: DailyOpsPeriodLevel
  /** business_date | ISO week YYYY-Wxx | YYYY-MM | YYYY */
  periodKey: string
  businessDateStart: string
  businessDateEnd: string
  status: DailyOpsPeriodStatus
  revenue: PeriodRevenueBlock
  labor: PeriodLaborBlock
  staff: PeriodStaffBlock
  cogs: PeriodCogsBlock
  ratios: PeriodRatiosBlock
  /** Child periodKeys (week→days, month→weeks, year→months). */
  childKeys?: string[]
  provenance: PeriodProvenance
}

/** Shared ratio doc — written on Finance seal / rolling refresh. */
export type RatioSnapshot = {
  schemaVersion: 1
  /** YYYY-MM for sealed month, or `rolling` for open-period defaults. */
  monthKey: string
  locationId: string
  source: 'finance_sealed' | 'rolling_12m'
  cogsPct: number
  foodCogsPct: number
  bevCogsPct: number
  fixedLaborPct: number
  flexLaborPct: number
  overheadPct: number
  breakEvenMonthly: number
  computedAt: string
}
