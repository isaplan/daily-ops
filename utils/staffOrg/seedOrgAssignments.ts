/**
 * @registry-id: staffOrgSeedOrgAssignments
 * @created: 2026-07-23T01:10:00.000Z
 * @last-modified: 2026-08-12T18:00:00.000Z
 * @description: Seed TeamBuilder assignments from roster home location + contract
 * @last-fix: [2026-08-12] Multi-location for all roles — dedupe by member×location×team
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/utils/staffOrg/scenarioRepo.ts
 * ✓ components/staffOrg/StaffOrgTeamBuilder.vue
 */

import type {
  StaffOrgAssignment,
  StaffOrgRole,
  StaffOrgRosterMember,
  StaffOrgTeam,
} from '~/types/staff-org'
import { classifyStaffContractType } from '~/utils/dailyOpsStaffContractBuckets'

export function roleFromContractType (contractType: string): StaffOrgRole {
  const bucket = classifyStaffContractType(contractType)
  if (bucket === 'pt') return 'pt'
  if (bucket === 'zzp') return 'zzp'
  return 'ft'
}

export function isZzpRole (role: StaffOrgRole): boolean {
  return role === 'zzp'
}

/**
 * Dedupe by member × location × team.
 * Same person may work at multiple venues (location pills / ZZP).
 */
export function dedupeOrgAssignments (list: StaffOrgAssignment[]): StaffOrgAssignment[] {
  const map = new Map<string, StaffOrgAssignment>()
  for (const a of list) {
    map.set(`${a.memberId}|${a.locationId}|${a.team}`, a)
  }
  return [...map.values()]
}

/**
 * Full rebuild from members home location.
 * - Has homeLocationId in openVenueIds → assign there (role from contract)
 * - No location / closed / unknown → unassigned (omitted)
 */
export function rebuildOrgAssignmentsFromRoster (args: {
  roster: StaffOrgRosterMember[]
  inactiveMemberIds: string[]
  openVenueIds: string[]
}): StaffOrgAssignment[] {
  const inactive = new Set(args.inactiveMemberIds)
  const open = new Set(args.openVenueIds)
  const out: StaffOrgAssignment[] = []

  for (const m of args.roster) {
    if (inactive.has(m.memberId)) continue
    const locationId = m.homeLocationId?.trim() || null
    if (!locationId || !open.has(locationId)) continue
    const team: StaffOrgTeam = m.teamHint ?? 'bediening'
    out.push({
      memberId: m.memberId,
      locationId,
      team,
      role: roleFromContractType(m.contractType),
    })
  }

  return dedupeOrgAssignments(out)
}

/** Add only brand-new roster members (never overwrite planner moves). */
export function mergeOrgAssignmentsFromRoster (args: {
  roster: StaffOrgRosterMember[]
  existing: StaffOrgAssignment[]
  inactiveMemberIds: string[]
  openVenueIds: string[]
}): StaffOrgAssignment[] {
  const inactive = new Set(args.inactiveMemberIds)
  const open = new Set(args.openVenueIds)
  const existingIds = new Set(
    args.existing.filter((a) => !inactive.has(a.memberId)).map((a) => a.memberId),
  )
  const next = [...args.existing.filter((a) => !inactive.has(a.memberId))]

  for (const m of args.roster) {
    if (inactive.has(m.memberId) || existingIds.has(m.memberId)) continue
    const locationId = m.homeLocationId?.trim() || null
    if (!locationId || !open.has(locationId)) continue
    next.push({
      memberId: m.memberId,
      locationId,
      team: m.teamHint ?? 'bediening',
      role: roleFromContractType(m.contractType),
    })
  }

  return dedupeOrgAssignments(next)
}
