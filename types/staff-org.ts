/**
 * @registry-id: staffOrgTypes
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-23T02:15:00.000Z
 * @description: Staff Org scenario / placement / metrics types (ADR-016)
 * @last-fix: [2026-07-23] executiveAssignments General/Keuken/Operations
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/utils/staffOrg/*
 * ✓ server/api/staff-org/*
 * ✓ pages/staff-org/*
 * ✓ components/staffOrg/*
 */

/** Monday = 0 … Sunday = 6 */
export type StaffOrgWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type StaffOrgSlot = 'day' | 'evening'

export type StaffOrgTeam = 'bediening' | 'keuken' | 'bar'

/**
 * Organogram role.
 * Non-ZZP: at most one assignment per member.
 * ZZP: may have multiple assignments (different venues).
 */
export type StaffOrgRole = 'manager' | 'floor_manager' | 'ft' | 'pt' | 'zzp'

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

/** Per-location planning targets for hour budget vs revenue. */
export type StaffOrgLocationTargets = {
  locationId: string
  /** e.g. Kinsbergen €150_000 / month */
  estimatedMonthlyRevenue: number
  /** Minimum € revenue per FT labor hour (productivity floor). */
  minLaborProductivity: number
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
  headcount: number
  minStaff: number
  maxStaff: number
  underMin: boolean
  overMax: boolean
}

/** Weeks per month for monthly→weekly revenue (150k → 37.5k). */
export const STAFF_ORG_WEEKS_PER_MONTH = 4
