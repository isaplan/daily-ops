/**
 * @registry-id: staffOrgProductivity
 * @created: 2026-07-22T22:45:00.000Z
 * @last-modified: 2026-07-23T10:40:00.000Z
 * @description: Weekly revenue + FT hour budget from monthly revenue & min €/h
 * @last-fix: [2026-07-23] Team rev split (food/bev); FT-only planned hours
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ components/staffOrg/StaffOrgBoard.vue
 * ✓ components/staffOrg/StaffOrgMetricsBar.vue
 * ✓ components/staffOrg/StaffOrgVenueBudgetCard.vue
 */

import type {
  StaffOrgAssignment,
  StaffOrgLocationTargets,
  StaffOrgPlacement,
  StaffOrgRosterMember,
  StaffOrgTeam,
} from '~/types/staff-org'
import { STAFF_ORG_WEEKS_PER_MONTH } from '~/types/staff-org'
import {
  revenueTeamForStaffTeam,
  sumFtPlacementHours,
} from '~/utils/staffOrg/contractLabor'

export type StaffOrgProductivityView = {
  monthlyRevenue: number
  weeklyRevenue: number
  /** Team slice of monthly (keuken = food; bediening/bar = beverage pot). */
  teamMonthlyRevenue: number
  teamWeeklyRevenue: number
  keukenRevenueShare: number
  bedieningRevenueShare: number
  minLaborProductivity: number
  /** Max FT hours this week to still hit min €/h (on team weekly rev). */
  hourBudget: number | null
  plannedHours: number
  hoursOverBudget: number | null
  impliedProductivity: number | null
  meetsMinProductivity: boolean | null
}

export function weeklyRevenueFromMonthly(monthly: number): number {
  if (!Number.isFinite(monthly) || monthly <= 0) return 0
  return monthly / STAFF_ORG_WEEKS_PER_MONTH
}

export function teamRevenueShare(
  t: StaffOrgLocationTargets | undefined,
  team: StaffOrgTeam | 'all',
): number {
  if (!t || team === 'all') return 1
  const pot = revenueTeamForStaffTeam(team)
  return pot === 'keuken'
    ? (t.keukenRevenueShare ?? 0.5)
    : (t.bedieningRevenueShare ?? 0.5)
}

export function buildProductivityView(args: {
  locationId: string
  targets: StaffOrgLocationTargets[]
  placements: StaffOrgPlacement[]
  roster?: StaffOrgRosterMember[]
  orgAssignments?: StaffOrgAssignment[]
  /** If set, only count this team's hours + team revenue slice. */
  team?: StaffOrgTeam
}): StaffOrgProductivityView {
  const t = args.targets.find((x) => x.locationId === args.locationId)
  const monthlyRevenue = t?.estimatedMonthlyRevenue ?? 0
  const minLaborProductivity = t?.minLaborProductivity ?? 0
  const keukenRevenueShare = t?.keukenRevenueShare ?? 0.5
  const bedieningRevenueShare = t?.bedieningRevenueShare ?? 0.5
  const share = teamRevenueShare(t, args.team ?? 'all')
  const teamMonthlyRevenue = monthlyRevenue * share
  const weeklyRevenue = weeklyRevenueFromMonthly(monthlyRevenue)
  const teamWeeklyRevenue = weeklyRevenueFromMonthly(teamMonthlyRevenue)

  const plannedHours = args.roster
    ? sumFtPlacementHours({
        locationId: args.locationId,
        placements: args.placements,
        roster: args.roster,
        orgAssignments: args.orgAssignments,
        team: args.team,
      })
    : args.placements
      .filter((p) =>
        p.locationId === args.locationId
        && (args.team == null || p.team === args.team),
      )
      .reduce((s, p) => s + (typeof p.hours === 'number' ? p.hours : 0), 0)

  const budgetBase = args.team != null ? teamWeeklyRevenue : weeklyRevenue
  const hourBudget = minLaborProductivity > 0 && budgetBase > 0
    ? Math.round((budgetBase / minLaborProductivity) * 10) / 10
    : null

  const impliedProductivity = plannedHours > 0 && budgetBase > 0
    ? Math.round((budgetBase / plannedHours) * 10) / 10
    : null

  const hoursOverBudget = hourBudget != null
    ? Math.round((plannedHours - hourBudget) * 10) / 10
    : null

  const meetsMinProductivity = impliedProductivity != null && minLaborProductivity > 0
    ? impliedProductivity >= minLaborProductivity
    : null

  return {
    monthlyRevenue,
    weeklyRevenue,
    teamMonthlyRevenue: Math.round(teamMonthlyRevenue),
    teamWeeklyRevenue: Math.round(teamWeeklyRevenue * 10) / 10,
    keukenRevenueShare,
    bedieningRevenueShare,
    minLaborProductivity,
    hourBudget,
    plannedHours: Math.round(plannedHours * 10) / 10,
    hoursOverBudget,
    impliedProductivity,
    meetsMinProductivity,
  }
}
