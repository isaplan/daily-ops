/**
 * @registry-id: staffOrgTeamOrgMetrics
 * @created: 2026-07-23T12:25:00.000Z
 * @last-modified: 2026-07-28T16:35:00.000Z
 * @description: Per location×team labor €, hours, budget + per-role / flex remainder
 * @last-fix: [2026-07-28] pt_sr lane; PT desiredWeeklyHours in flex metrics
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ components/staffOrg/StaffOrgTeamBuilder.vue
 */

import type {
  StaffOrgAssignment,
  StaffOrgLocationTargets,
  StaffOrgRole,
  StaffOrgRosterMember,
  StaffOrgSlotHours,
  StaffOrgTeam,
} from '~/types/staff-org'
import { STAFF_ORG_WEEKS_PER_MONTH } from '~/types/staff-org'
import { isContractFtRole, revenueTeamForStaffTeam, weeklyHoursForRole } from '~/utils/staffOrg/contractLabor'

export type StaffOrgRoleLaneMetrics = {
  role: StaffOrgRole
  laborCostMonthly: number
  hoursAllocatedMonthly: number
  headcount: number
}

export type StaffOrgTeamColumnMetrics = {
  team: StaffOrgTeam
  laborCostMonthly: number
  hoursAvailableMonthly: number
  hoursAllocatedMonthly: number
  hoursRemainingMonthly: number
  laborBudgetMonthly: number | null
  budgetRemainingMonthly: number | null
  /** Contract lanes (manager / floor / ft). */
  byRole: Partial<Record<StaffOrgRole, StaffOrgRoleLaneMetrics>>
  /** Hours left after contract roles (room for PT/ZZP). */
  flexHoursRemainingMonthly: number
  /** Budget left after contract labor (room for PT/ZZP). */
  flexBudgetRemainingMonthly: number | null
  /** PT+ZZP cost already placed. */
  flexLaborCostMonthly: number
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function targetLaborPct(t: StaffOrgLocationTargets | undefined): number | null {
  if (!t) return null
  const pct = t.laborCostPctTarget?.ft ?? t.laborCostPctTarget?.total ?? null
  return pct != null && pct > 0 ? pct : null
}

function weeklyOpenHours(
  slotHours: StaffOrgSlotHours[],
  locationId: string,
  team: StaffOrgTeam,
): number {
  return slotHours
    .filter((s) => s.locationId === locationId && s.team === team && s.openHours != null)
    .reduce((sum, s) => sum + (s.openHours ?? 0), 0)
}

function emptyRoleBucket(role: StaffOrgRole): StaffOrgRoleLaneMetrics {
  return { role, laborCostMonthly: 0, hoursAllocatedMonthly: 0, headcount: 0 }
}

/**
 * Labor cost + hours + budget headroom per team column for one venue.
 * Beverage pot (bediening+bar) is split by open-hours share.
 */
export function buildTeamColumnMetrics(args: {
  locationId: string
  targets: StaffOrgLocationTargets[]
  roster: StaffOrgRosterMember[]
  orgAssignments: StaffOrgAssignment[]
  inactiveMemberIds: string[]
  slotHours: StaffOrgSlotHours[]
}): StaffOrgTeamColumnMetrics[] {
  const t = args.targets.find((x) => x.locationId === args.locationId)
  const inactive = new Set(args.inactiveMemberIds)
  const rosterById = new Map(args.roster.map((m) => [m.memberId, m]))
  const teams: StaffOrgTeam[] = ['keuken', 'bediening', 'bar']
  const roles: StaffOrgRole[] = ['manager', 'floor_manager', 'ft', 'pt_sr', 'pt', 'zzp']

  const openWeekly: Record<StaffOrgTeam, number> = {
    keuken: weeklyOpenHours(args.slotHours, args.locationId, 'keuken'),
    bediening: weeklyOpenHours(args.slotHours, args.locationId, 'bediening'),
    bar: weeklyOpenHours(args.slotHours, args.locationId, 'bar'),
  }

  const byTeamRole = new Map<string, StaffOrgRoleLaneMetrics>()
  for (const team of teams) {
    for (const role of roles) {
      byTeamRole.set(`${team}|${role}`, emptyRoleBucket(role))
    }
  }

  for (const a of args.orgAssignments) {
    if (a.locationId !== args.locationId || inactive.has(a.memberId)) continue
    const member = rosterById.get(a.memberId)
    if (!member) continue
    const key = `${a.team}|${a.role}`
    const bucket = byTeamRole.get(key) ?? emptyRoleBucket(a.role)
    bucket.headcount += 1
    const weekly = weeklyHoursForRole(member, a.role)
    if (weekly > 0) {
      bucket.hoursAllocatedMonthly += weekly * STAFF_ORG_WEEKS_PER_MONTH
      bucket.laborCostMonthly += weekly * member.costPerHour * STAFF_ORG_WEEKS_PER_MONTH
    }
    byTeamRole.set(key, bucket)
  }

  const monthlyRev = t?.estimatedMonthlyRevenue ?? 0
  const pct = targetLaborPct(t)
  const keukenRev = monthlyRev * (t?.keukenRevenueShare ?? 0.5)
  const bevRev = monthlyRev * (t?.bedieningRevenueShare ?? 0.5)
  const keukenBudget = pct != null ? keukenRev * (pct / 100) : null
  const bevBudget = pct != null ? bevRev * (pct / 100) : null
  const bevOpen = openWeekly.bediening + openWeekly.bar

  return teams.map((team) => {
    const byRole: Partial<Record<StaffOrgRole, StaffOrgRoleLaneMetrics>> = {}
    let laborCostMonthly = 0
    let hoursAllocatedMonthly = 0
    let contractCost = 0
    let contractHours = 0
    let flexCost = 0

    for (const role of roles) {
      const raw = byTeamRole.get(`${team}|${role}`) ?? emptyRoleBucket(role)
      const slice: StaffOrgRoleLaneMetrics = {
        role,
        laborCostMonthly: Math.round(raw.laborCostMonthly),
        hoursAllocatedMonthly: round1(raw.hoursAllocatedMonthly),
        headcount: raw.headcount,
      }
      byRole[role] = slice
      laborCostMonthly += slice.laborCostMonthly
      hoursAllocatedMonthly += slice.hoursAllocatedMonthly
      if (isContractFtRole(role)) {
        contractCost += slice.laborCostMonthly
        contractHours += slice.hoursAllocatedMonthly
      } else {
        flexCost += slice.laborCostMonthly
      }
    }

    const hoursAvailableMonthly = round1(openWeekly[team] * STAFF_ORG_WEEKS_PER_MONTH)

    let laborBudgetMonthly: number | null = null
    if (revenueTeamForStaffTeam(team) === 'keuken') {
      laborBudgetMonthly = keukenBudget != null ? Math.round(keukenBudget) : null
    } else if (bevBudget != null) {
      const share = bevOpen > 0 ? openWeekly[team] / bevOpen : 0.5
      laborBudgetMonthly = Math.round(bevBudget * share)
    }

    const budgetRemainingMonthly = laborBudgetMonthly != null
      ? laborBudgetMonthly - laborCostMonthly
      : null

    const flexHoursRemainingMonthly = round1(hoursAvailableMonthly - contractHours)
    const flexBudgetRemainingMonthly = laborBudgetMonthly != null
      ? laborBudgetMonthly - contractCost
      : null

    return {
      team,
      laborCostMonthly: Math.round(laborCostMonthly),
      hoursAvailableMonthly,
      hoursAllocatedMonthly: round1(hoursAllocatedMonthly),
      hoursRemainingMonthly: round1(hoursAvailableMonthly - hoursAllocatedMonthly),
      laborBudgetMonthly,
      budgetRemainingMonthly,
      byRole,
      flexHoursRemainingMonthly,
      flexBudgetRemainingMonthly,
      flexLaborCostMonthly: Math.round(flexCost),
    }
  })
}
