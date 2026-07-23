/**
 * @registry-id: staffOrgContractLabor
 * @created: 2026-07-23T10:40:00.000Z
 * @last-modified: 2026-07-23T10:40:00.000Z
 * @description: FT/contract labor helpers — Managers/Chefs always FT
 * @last-fix: [2026-07-23] Monthly contract cost from org + FT placement filter
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ utils/staffOrg/productivity.ts
 * ✓ components/staffOrg/StaffOrgVenueBudgetCard.vue
 * ✓ components/staffOrg/StaffOrgBoard.vue
 */

import type {
  StaffOrgAssignment,
  StaffOrgPlacement,
  StaffOrgRole,
  StaffOrgRosterMember,
  StaffOrgTeam,
} from '~/types/staff-org'
import { STAFF_ORG_WEEKS_PER_MONTH } from '~/types/staff-org'
import { classifyStaffContractType } from '~/utils/dailyOpsStaffContractBuckets'

const FT_ROLES: StaffOrgRole[] = ['manager', 'floor_manager', 'ft']

/** Managers / Chefs / Floor / FT lanes are always contract hours. */
export function isContractFtRole(role: StaffOrgRole | null | undefined): boolean {
  if (!role) return false
  return FT_ROLES.includes(role)
}

export function isContractFtMember(
  member: StaffOrgRosterMember,
  role?: StaffOrgRole | null,
): boolean {
  if (isContractFtRole(role)) return true
  if (role === 'pt' || role === 'zzp') return false
  return classifyStaffContractType(member.contractType) === 'ft'
}

/** Bediening revenue pot covers bediening + bar. */
export function revenueTeamForStaffTeam(team: StaffOrgTeam): 'keuken' | 'bediening' {
  return team === 'keuken' ? 'keuken' : 'bediening'
}

export function monthlyContractLaborFromOrg(args: {
  locationId: string
  roster: StaffOrgRosterMember[]
  orgAssignments: StaffOrgAssignment[]
  inactiveMemberIds?: string[]
}): number {
  const inactive = new Set(args.inactiveMemberIds ?? [])
  const rosterById = new Map(args.roster.map((m) => [m.memberId, m]))
  const seen = new Set<string>()
  let monthly = 0

  for (const a of args.orgAssignments) {
    if (a.locationId !== args.locationId) continue
    if (inactive.has(a.memberId) || seen.has(a.memberId)) continue
    const member = rosterById.get(a.memberId)
    if (!member || !isContractFtMember(member, a.role)) continue
    seen.add(a.memberId)
    const weekly = member.weeklyContractHours ?? 0
    if (weekly <= 0) continue
    monthly += weekly * member.costPerHour * STAFF_ORG_WEEKS_PER_MONTH
  }

  return Math.round(monthly)
}

export function sumFtPlacementHours(args: {
  locationId: string
  placements: StaffOrgPlacement[]
  roster: StaffOrgRosterMember[]
  orgAssignments?: StaffOrgAssignment[]
  team?: StaffOrgTeam
}): number {
  const rosterById = new Map(args.roster.map((m) => [m.memberId, m]))
  const roleByKey = new Map<string, StaffOrgRole>()
  for (const a of args.orgAssignments ?? []) {
    roleByKey.set(`${a.memberId}|${a.locationId}|${a.team}`, a.role)
  }

  let hours = 0
  for (const p of args.placements) {
    if (p.locationId !== args.locationId) continue
    if (args.team != null && p.team !== args.team) continue
    const member = rosterById.get(p.memberId)
    if (!member) continue
    const role = roleByKey.get(`${p.memberId}|${p.locationId}|${p.team}`)
    if (!isContractFtMember(member, role)) continue
    hours += typeof p.hours === 'number' ? p.hours : 0
  }
  return Math.round(hours * 10) / 10
}
