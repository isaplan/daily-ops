/**
 * @registry-id: staffOrgContractHours
 * @created: 2026-07-22T22:30:00.000Z
 * @last-modified: 2026-08-13T11:20:00.000Z
 * @description: Split weekly contract hours across planned days; suggest day count
 * @last-fix: [2026-08-13] desiredWeeklyDays + name defaults for known part-week FT
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ components/staffOrg/StaffOrgBoard.vue
 * ✓ components/staffOrg/StaffOrgStaffCard.vue
 * ✓ server/utils/staffOrg/scenarioRepo.ts
 */

import type { StaffOrgPlacement, StaffOrgRosterMember } from '~/types/staff-org'

/** Assumed shift length when estimating how many days fit a contract. */
export const STAFF_ORG_TYPICAL_DAY_HOURS = 8

/** Known planner day targets when roster has no override yet (match on display name). */
const PLANNER_DAY_NAME_DEFAULTS: Array<{ match: RegExp; days: number }> = [
  { match: /eric\s+falter/i, days: 3 },
  { match: /\binna\b/i, days: 4 },
  { match: /yetkin/i, days: 2 },
  { match: /hannah\s+lipman/i, days: 4 },
]

export function suggestedDaysForContract (weeklyContractHours: number | null | undefined): number | null {
  if (weeklyContractHours == null || weeklyContractHours <= 0) return null
  return Math.max(1, Math.round(weeklyContractHours / STAFF_ORG_TYPICAL_DAY_HOURS))
}

/** Prefer planner day override, else hours ÷ 8. */
export function suggestedDaysForMember (member: StaffOrgRosterMember): number | null {
  const d = member.desiredWeeklyDays
  if (d != null && Number.isFinite(d) && d > 0) {
    return Math.min(7, Math.max(1, Math.round(d)))
  }
  const hours = member.desiredWeeklyHours ?? member.weeklyContractHours
  return suggestedDaysForContract(hours)
}

/** Apply name defaults only when desiredWeeklyDays was never set. */
export function applyPlannerDayNameDefaults (
  roster: StaffOrgRosterMember[],
): StaffOrgRosterMember[] {
  return roster.map((m) => {
    if (m.desiredWeeklyDays !== undefined) return m
    const hit = PLANNER_DAY_NAME_DEFAULTS.find((row) => row.match.test(m.name))
    if (!hit) return m
    return { ...m, desiredWeeklyDays: hit.days }
  })
}

export function hoursPerDayFromContract (
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
export function rebalanceContractHours (
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
    const member = rosterById.get(memberId)
    const contract = member?.desiredWeeklyHours ?? member?.weeklyContractHours
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

function placementKey (p: StaffOrgPlacement): string {
  return `${p.memberId}|${p.locationId}|${p.team}|${p.weekday}|${p.slot}`
}
