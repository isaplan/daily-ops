/**
 * @registry-id: staffOrgProductivity
 * @created: 2026-07-22T22:45:00.000Z
 * @last-modified: 2026-07-22T22:45:00.000Z
 * @description: Weekly revenue + FT hour budget from monthly revenue & min €/h
 * @last-fix: [2026-07-22] Hour budget = weeklyRevenue / minLaborProductivity
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ components/staffOrg/StaffOrgBoard.vue
 * ✓ components/staffOrg/StaffOrgMetricsBar.vue
 */

import type { StaffOrgLocationTargets, StaffOrgPlacement } from '~/types/staff-org'
import { STAFF_ORG_WEEKS_PER_MONTH } from '~/types/staff-org'

export type StaffOrgProductivityView = {
  monthlyRevenue: number
  weeklyRevenue: number
  minLaborProductivity: number
  /** Max FT hours this week to still hit min €/h. */
  hourBudget: number | null
  plannedHours: number
  /** planned − budget; >0 = too many hours (productivity too low). */
  hoursOverBudget: number | null
  /** weeklyRevenue / plannedHours when planned > 0. */
  impliedProductivity: number | null
  /** implied >= min (or no min set). */
  meetsMinProductivity: boolean | null
}

export function weeklyRevenueFromMonthly(monthly: number): number {
  if (!Number.isFinite(monthly) || monthly <= 0) return 0
  return monthly / STAFF_ORG_WEEKS_PER_MONTH
}

export function buildProductivityView(args: {
  locationId: string
  targets: StaffOrgLocationTargets[]
  placements: StaffOrgPlacement[]
  /** If set, only count this team's hours; else all teams at location. */
  team?: string
}): StaffOrgProductivityView {
  const t = args.targets.find((x) => x.locationId === args.locationId)
  const monthlyRevenue = t?.estimatedMonthlyRevenue ?? 0
  const minLaborProductivity = t?.minLaborProductivity ?? 0
  const weeklyRevenue = weeklyRevenueFromMonthly(monthlyRevenue)

  const plannedHours = args.placements
    .filter((p) =>
      p.locationId === args.locationId
      && (args.team == null || p.team === args.team),
    )
    .reduce((s, p) => s + (typeof p.hours === 'number' ? p.hours : 0), 0)

  const hourBudget = minLaborProductivity > 0 && weeklyRevenue > 0
    ? Math.round((weeklyRevenue / minLaborProductivity) * 10) / 10
    : null

  const impliedProductivity = plannedHours > 0 && weeklyRevenue > 0
    ? Math.round((weeklyRevenue / plannedHours) * 10) / 10
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
    minLaborProductivity,
    hourBudget,
    plannedHours: Math.round(plannedHours * 10) / 10,
    hoursOverBudget,
    impliedProductivity,
    meetsMinProductivity,
  }
}
