/**
 * @registry-id: dailyOpsDashboardBundleAssembleLabor
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Assemble DailyOpsLaborMetricsDto from snapshot labor/revenue rows
 * @last-fix: [2026-05-28] Extract contract + productivity rollups to focused modules
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { DailyOpsLaborDayDto, DailyOpsLaborMetricsDto } from '~/types/daily-ops-dashboard'
import { enumerateUtcDatesInclusive, type DailyOpsMetricsContext } from '../../dailyOpsDashboardMetrics'
import { contractRollupsFromSnapshotLabor } from './laborContractRollups'
import { productivityByLocationFromSnapshots } from './laborProductivityRollups'
import type { SnapshotDashboardRows } from './loadSnapshotRows'
import { round2 } from './shared'

export { contractRollupsFromSnapshotLabor } from './laborContractRollups'

export function assembleLaborFromSnapshots(
  ctx: DailyOpsMetricsContext,
  rows: SnapshotDashboardRows,
  revMap: Map<string, number>,
  labMap: Map<string, { laborCost: number; hours: number; distinctWorkerCount: number }>,
  revByDateLocation: Map<string, number>,
  contractWarm: {
    hoursCostByContractType: DailyOpsLaborMetricsDto['hoursCostByContractType']
    contractTypeByDay: DailyOpsLaborMetricsDto['contractTypeByDay']
  },
): DailyOpsLaborMetricsDto {
  const days = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate)
  const teamPeriod = new Map<
    string,
    {
      locationId: string
      locationName: string
      teamId: string
      teamName: string
      workerIds: Set<string>
      totalHours: number
      totalCost: number
    }
  >()
  const teamByDay: DailyOpsLaborMetricsDto['workersByTeamLocationByDay'] = []

  for (const doc of rows.labor) {
    for (const t of doc.teams ?? []) {
      const k = `${doc.locationId}|${t.teamId}`
      let agg = teamPeriod.get(k)
      if (!agg) {
        agg = {
          locationId: doc.locationId,
          locationName: doc.locationName,
          teamId: t.teamId,
          teamName: t.teamName,
          workerIds: new Set(),
          totalHours: 0,
          totalCost: 0,
        }
        teamPeriod.set(k, agg)
      }
      agg.totalHours += Number(t.hours ?? 0)
      agg.totalCost += Number(t.loaded_cost ?? 0)
    }
    for (const w of doc.workers ?? []) {
      const k = `${doc.locationId}|${w.teamId}`
      teamPeriod.get(k)?.workerIds.add(w.userId)
    }
    for (const t of doc.teams ?? []) {
      teamByDay.push({
        date: doc.businessDate,
        locationId: doc.locationId,
        locationName: doc.locationName,
        teamId: t.teamId,
        teamName: t.teamName,
        workerCount: (doc.workers ?? []).filter((w) => w.teamId === t.teamId).length,
        totalHours: round2(Number(t.hours ?? 0)),
        totalCost: round2(Number(t.loaded_cost ?? 0)),
        laborCostPctOfRevenue: null,
      })
    }
  }

  const workersByTeamLocation = [...teamPeriod.values()].map((a) => ({
    locationId: a.locationId,
    locationName: a.locationName,
    teamId: a.teamId,
    teamName: a.teamName,
    workerCount: a.workerIds.size,
    totalHours: round2(a.totalHours),
    totalCost: round2(a.totalCost),
  }))

  const locationDayKey = (date: string, locationId: string) => `${date}|${locationId}`
  const locDayAgg = new Map<string, { hours: number; cost: number }>()
  for (const row of teamByDay) {
    const k = locationDayKey(row.date, row.locationId)
    const a = locDayAgg.get(k) ?? { hours: 0, cost: 0 }
    a.hours += row.totalHours
    a.cost += row.totalCost
    locDayAgg.set(k, a)
  }

  const workersByTeamLocationByDay = teamByDay.map((row) => {
    const k = locationDayKey(row.date, row.locationId)
    const rev = revByDateLocation.get(k) ?? 0
    const agg = locDayAgg.get(k) ?? { hours: 0, cost: 0 }
    let attributedRev = 0
    if (rev > 0 && agg.hours > 0) attributedRev = rev * (row.totalHours / agg.hours)
    const laborCostPctOfRevenue =
      attributedRev > 0 ? Math.round((row.totalCost / attributedRev) * 100 * 10) / 10 : null
    return { ...row, laborCostPctOfRevenue }
  })

  const revenueByLocationDay: DailyOpsLaborMetricsDto['revenueByLocationDay'] = []
  for (const [k, revenue] of revByDateLocation) {
    const [date = '', locationId = ''] = k.split('|')
    revenueByLocationDay.push({ date, locationId, revenue: round2(revenue) })
  }
  revenueByLocationDay.sort((a, b) => a.locationId.localeCompare(b.locationId) || a.date.localeCompare(b.date))

  const locationLaborPctByDay: DailyOpsLaborMetricsDto['locationLaborPctByDay'] = []
  for (const [k, agg] of locDayAgg) {
    const [date = '', locationId = ''] = k.split('|')
    const rev = revByDateLocation.get(k) ?? 0
    locationLaborPctByDay.push({
      date,
      locationId,
      laborCostPctOfRevenue: rev > 0 ? Math.round((agg.cost / rev) * 100 * 10) / 10 : null,
    })
  }

  let sumRev = 0
  let sumLab = 0
  let sumHours = 0
  const daily: DailyOpsLaborDayDto[] = days.map((date) => {
    const revenue = revMap.get(date) ?? 0
    const lab = labMap.get(date)
    const laborCost = lab?.laborCost ?? 0
    const hours = lab?.hours ?? 0
    const distinctWorkerCount = lab?.distinctWorkerCount ?? 0
    sumRev += revenue
    sumLab += laborCost
    sumHours += hours
    return {
      date,
      revenue: round2(revenue),
      laborCost: round2(laborCost),
      hours: round2(hours),
      distinctWorkerCount,
      laborCostPctOfRevenue: revenue > 0 ? Math.round((laborCost / revenue) * 100 * 10) / 10 : null,
      revenuePerLaborHour: hours > 0 ? round2(revenue / hours) : null,
    }
  })

  const snapshotContracts = contractRollupsFromSnapshotLabor(rows.labor)
  const hoursCostByContractType =
    snapshotContracts.hoursCostByContractType.length > 0
      ? snapshotContracts.hoursCostByContractType
      : contractWarm.hoursCostByContractType
  const contractTypeByDay =
    snapshotContracts.contractTypeByDay.length > 0
      ? snapshotContracts.contractTypeByDay
      : contractWarm.contractTypeByDay

  return {
    range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
    inventory: {
      hasBorkCronData: rows.revenue.some((r) => (r.intraday?.length ?? 0) > 0),
      hasBorkHourData: rows.hourly.length > 0 || rows.revenue.some((r) => (r.hourly?.length ?? 0) > 0),
      hasEitjeAggData: rows.labor.length > 0 || rows.masters.some((m) => m.sections?.labor),
      notes: ['Read from daily_ops_snapshot* (ADR-004).'],
    },
    workersByTeamLocation,
    workersByTeamLocationByDay,
    locationLaborPctByDay,
    revenueByLocationDay,
    hoursCostByContractType,
    contractTypeByDay,
    daily,
    periodRollup: {
      revenue: round2(sumRev),
      laborCost: round2(sumLab),
      hours: round2(sumHours),
      laborCostPctOfRevenue: sumRev > 0 ? Math.round((sumLab / sumRev) * 100 * 10) / 10 : null,
      revenuePerLaborHour: sumHours > 0 ? round2(sumRev / sumHours) : null,
    },
    productivityByLocationDay: productivityByLocationFromSnapshots(rows.labor, revByDateLocation),
  }
}
