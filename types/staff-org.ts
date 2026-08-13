/**
 * @registry-id: staffOrgTypes
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-08-13T11:20:00.000Z
 * @description: Staff Org scenario / placement / metrics types (ADR-016)
 * @last-fix: [2026-08-13] desiredWeeklyDays on roster for FT days/week override
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/utils/staffOrg/*
 * ✓ server/api/staff-org/*
 * ✓ pages/staff-org/*
 * ✓ components/staffOrg/*
 * ✓ utils/staffOrg/locationTargets.ts
 * ✓ utils/staffOrg/productivity.ts
 * ✓ utils/accountingPnl/costEnvelope.ts
 */

/** Monday = 0 … Sunday = 6 */
export type StaffOrgWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type StaffOrgSlot = 'day' | 'evening'

export type StaffOrgTeam = 'bediening' | 'keuken' | 'bar'

/**
 * Organogram role.
 * Anyone may have assignments at multiple venues (location pills).
 * ZZP may also sit on multiple teams per venue.
 * pt_sr = senior PT (fixed days/week); pt = flexible PT (hours available).
 */
export type StaffOrgRole = 'manager' | 'floor_manager' | 'ft' | 'pt_sr' | 'pt' | 'zzp'

export type StaffOrgScenarioStatus = 'draft' | 'active' | 'archived'

export type StaffOrgVenueStatus = 'open' | 'closed'

/** Scenario-owned venue — can close LAT or add a future site. */
export type StaffOrgVenue = {
  locationId: string
  name: string
  short: string
  status: StaffOrgVenueStatus
}

/** Cross-location executive staff (above all venues). */
export type StaffOrgExecutiveArea = 'general' | 'keuken' | 'operations'

export type StaffOrgExecutiveAssignment = {
  memberId: string
  area: StaffOrgExecutiveArea
}

/** Who belongs where / which role — SSOT before roster placements. */
export type StaffOrgAssignment = {
  memberId: string
  locationId: string
  team: StaffOrgTeam
  role: StaffOrgRole
}

export type StaffOrgRosterMember = {
  memberId: string
  name: string
  teamHint: StaffOrgTeam | null
  contractType: string
  weeklyContractHours: number | null
  /**
   * Planner override — hours PT / PT Sr is available or wants to work (u/w).
   * Scenario-owned; survives roster sync when merged by memberId.
   */
  desiredWeeklyHours?: number | null
  /**
   * Planner override — target workdays per week (FT part-timers, stagair, etc.).
   * When set, cards show Nd and Roster “fully scheduled” uses this.
   */
  desiredWeeklyDays?: number | null
  hourlyRate: number
  costPerHour: number
  homeLocationId: string | null
}

export type StaffOrgPlacement = {
  memberId: string
  locationId: string
  team: StaffOrgTeam
  weekday: StaffOrgWeekday
  slot: StaffOrgSlot
  /** Assigned hours for this cell; defaults to slot open hours when omitted. */
  hours?: number
}

export type StaffOrgLocationRule = {
  locationId: string
  team: StaffOrgTeam
  weekday: StaffOrgWeekday
  slot: StaffOrgSlot
  minStaff: number
  maxStaff: number
}

/**
 * Labor cost % of revenue — total + contract buckets.
 * P&L Lonen map: ft=salaris*, pt=inhuurFb, zzp=other inhuur* (Afwas/Stewarding/Keuken/Overhead).
 */
export type StaffOrgLaborCostPctBuckets = {
  total: number | null
  ft: number | null
  pt: number | null
  zzp: number | null
}

/** Per-location planning targets for hour budget vs revenue. */
export type StaffOrgLocationTargets = {
  locationId: string
  /** e.g. Kinsbergen €150_000 / month */
  estimatedMonthlyRevenue: number
  /** Minimum € revenue per FT labor hour (productivity floor). */
  minLaborProductivity: number
  /**
   * Food revenue → keuken; beverage → bediening + bar (shared pot).
   * Shares should sum to ~1.
   */
  keukenRevenueShare: number
  bedieningRevenueShare: number
  /** Override monthly contract (FT) labor €; null = derive from org roster. */
  contractLaborCostMonthly: number | null
  /** Seeded from P&L / staff timeseries (read-only display). */
  laborCostPctActual: StaffOrgLaborCostPctBuckets
  /** Planner target — “what it should be”. */
  laborCostPctTarget: StaffOrgLaborCostPctBuckets
  /**
   * Finance cost envelope snapshot (rev−10%, COGS@25%, flex leftover).
   * Null until Seed / Save from budget card.
   */
  costEnvelope: StaffOrgCostEnvelopeSnapshot | null
}

/** Persisted / seeded Finance cost envelope aligned with Analytics budget. */
export type StaffOrgCostEnvelopeSnapshot = {
  costBudget: number
  cogsBudget: number
  laborOhBudget: number
  fixedLabor: number
  fixedOh: number
  flexBudget: number
  /** Weekly = monthly ÷ STAFF_ORG_WEEKS_PER_MONTH */
  weekCostBudget: number
  weekFlexBudget: number
  targetMargin: number
  targetCogsPct: number
}

/** Seed payload from last-12 sealed accounting P&L months (ADR-016). */
export type StaffOrgLaborBenchmark = {
  locationId: string
  /** Newest year in the rolling window (compat / display). */
  year: number
  monthlyRevenue: number
  laborCostPct: StaffOrgLaborCostPctBuckets
  keukenRevenueShare: number
  bedieningRevenueShare: number
  /** Avg fixed labor €/mo from clean sealed months (OH-stamp excluded). */
  fixedLaborMonthly: number
  /** Avg fixed OH €/mo from clean sealed months. */
  fixedOhMonthly: number
  /** Envelope at monthlyRevenue (10% / COGS 25% / flex leftover). */
  costEnvelope: StaffOrgCostEnvelopeSnapshot
}

export type StaffOrgScenario = {
  _id: string
  name: string
  status: StaffOrgScenarioStatus
  createdAt: string
  updatedAt: string
  /** Scenario venues (open shown on board; closed → staff unassigned). */
  venues: StaffOrgVenue[]
  locationRules: StaffOrgLocationRule[]
  locationTargets: StaffOrgLocationTargets[]
  placements: StaffOrgPlacement[]
  roster: StaffOrgRosterMember[]
  /** TeamBuilder organogram — location × team × role. */
  orgAssignments: StaffOrgAssignment[]
  /** Above all locations — General / Keuken / Operations. */
  executiveAssignments: StaffOrgExecutiveAssignment[]
  /** Not active in this scenario (leaving / long sick) — off board, slots free up. */
  inactiveMemberIds: string[]
  /**
   * Permanently hidden from Not active / Unassigned UI (will never return).
   * Still treated like inactive for board/org pruning.
   */
  hiddenMemberIds: string[]
}

export type StaffOrgScenarioListItem = {
  _id: string
  name: string
  status: StaffOrgScenarioStatus
  createdAt: string
  updatedAt: string
  placementCount: number
  rosterCount: number
}

export type StaffOrgSlotHours = {
  locationId: string
  locationName: string
  weekday: StaffOrgWeekday
  team: StaffOrgTeam
  slot: StaffOrgSlot
  /** Null when venue/team closed that day. */
  openHours: number | null
  open: string | null
  close: string | null
}

export type StaffOrgCellMetrics = {
  locationId: string
  team: StaffOrgTeam
  weekday: StaffOrgWeekday
  slot: StaffOrgSlot
  openHours: number | null
  assignedHours: number
  laborCost: number
  /** FT headcount only (Chef / Manager / Floor / FT) — compared to min/max. */
  headcount: number
  minStaff: number
  maxStaff: number
  underMin: boolean
  overMax: boolean
}

/** Weeks per month for monthly→weekly revenue (150k → 37.5k). */
export const STAFF_ORG_WEEKS_PER_MONTH = 4
