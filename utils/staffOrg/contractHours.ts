/**
 * @registry-id: staffOrgContractHours
 * @created: 2026-07-22T22:30:00.000Z
 * @last-modified: 2026-07-22T22:30:00.000Z
 * @description: Split weekly contract hours across planned days; suggest day count
 * @last-fix: [2026-07-22] Even split contract ÷ days for Staff Org planner
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ components/staffOrg/StaffOrgBoard.vue
 * ✓ components/staffOrg/StaffOrgStaffCard.vue
 */

import type { StaffOrgPlacement, StaffOrgRosterMember } from '~/types/staff-org'

/** Assumed shift length when estimating how many days fit a contract. */
export const STAFF_ORG_TYPICAL_DAY_HOURS = 8

export function suggestedDaysForContract(weeklyContractHours: number | null | undefined): number | null {
  if (weeklyContractHours == null || weeklyContractHours <= 0) return null
  return Math.max(1, Math.round(weeklyContractHours / STAFF_ORG_TYPICAL_DAY_HOURS))
}

export function hoursPerDayFromContract(
  weeklyContractHours: number | null | undefined,
  placedDays: number,
): number | null {
  if (weeklyContractHours == null || weeklyContractHours <= 0 || placedDays <= 0) return null
  return Math.round((weeklyContractHours / placedDays) * 10) / 10
}

/**
 * Evenly split each member's weekly contract across their placements (by day count).
 * Same hours on every placement for that member so week total ≈ contract.
 */
export function rebalanceContractHours(
  placements: StaffOrgPlacement[],
  roster: StaffOrgRosterMember[],
  memberIds?: string[],
): StaffOrgPlacement[] {
  const rosterById = new Map(roster.map((m) => [m.memberId, m]))
  const targets = memberIds?.length
    ? new Set(memberIds)
    : new Set(placements.map((p) => p.memberId))

  const byMember = new Map<string, StaffOrgPlacement[]>()
  for (const p of placements) {
    if (!targets.has(p.memberId)) continue
    const arr = byMember.get(p.memberId) ?? []
    arr.push(p)
    byMember.set(p.memberId, arr)
  }

  const hoursByKey = new Map<string, number>()
  for (const [memberId, list] of byMember) {
    const contract = rosterById.get(memberId)?.weeklyContractHours
    const n = list.length
    if (contract == null || contract <= 0 || n === 0) continue
    const base = Math.floor((contract / n) * 10) / 10
    let allocated = 0
    list.forEach((p, i) => {
      const key = placementKey(p)
      if (i === n - 1) {
        hoursByKey.set(key, Math.round((contract - allocated) * 10) / 10)
      } else {
        hoursByKey.set(key, base)
        allocated += base
      }
    })
  }

  return placements.map((p) => {
    const h = hoursByKey.get(placementKey(p))
    if (h == null) return p
    return { ...p, hours: h }
  })
}

function placementKey(p: StaffOrgPlacement): string {
  return `${p.memberId}|${p.locationId}|${p.team}|${p.weekday}|${p.slot}`
}
