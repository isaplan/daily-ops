/**
 * @registry-id: dailyOpsDashboardBundleAssembleLabor
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Assemble DailyOpsLaborMetricsDto from snapshot labor/revenue rows
 * @adr-ref: ADR-004
 */

import type { DailyOpsLaborDayDto, DailyOpsLaborMetricsDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsSnapshotLaborSection } from '~/types/daily-ops-snapshot'
import { enumerateUtcDatesInclusive, type DailyOpsMetricsContext } from '../../dailyOpsDashboardMetrics'
import type { SnapshotDashboardRows } from './loadSnapshotRows'
import { round2 } from './shared'

export function contractRollupsFromSnapshotLabor(labor: DailyOpsSnapshotLaborSection[]): {
  hoursCostByContractType: DailyOpsLaborMetricsDto['hoursCostByContractType']
  contractTypeByDay: DailyOpsLaborMetricsDto['contractTypeByDay']
} {
  const periodMap = new Map<string, { hours: number; cost: number; workerIds: Set<string> }>()
  const dayMap = new Map<
    string,
    { date: string; contractType: string; hours: number; cost: number; workerIds: Set<string> }
  >()

  for (const doc of labor) {
    const ingest = (contractType: string, hours: number, loaded: number, userId?: string) => {
      const ct = contractType || '—'
      let p = periodMap.get(ct)
      if (!p) {
        p = { hours: 0, cost: 0, workerIds: new Set() }
        periodMap.set(ct, p)
      }
      p.hours += hours
      p.cost += loaded
      if (userId) p.workerIds.add(userId)

      const dayKey = `${doc.businessDate}|${ct}`
      let d = dayMap.get(dayKey)
      if (!d) {
        d = { date: doc.businessDate, contractType: ct, hours: 0, cost: 0, workerIds: new Set() }
        dayMap.set(dayKey, d)
      }
      d.hours += hours
      d.cost += loaded
      if (userId) d.workerIds.add(userId)
    }

    if (doc.contracts?.length) {
      for (const c of doc.contracts) {
        ingest(c.contractType, Number(c.hours ?? 0), Number(c.loaded_cost ?? 0))
      }
      continue
    }
    for (const w of doc.workers ?? []) {
      ingest(w.contractType ?? '—', Number(w.hours ?? 0), Number(w.loaded_cost ?? 0), w.userId)
    }
  }

  const hoursCostByContractType = [...periodMap.entries()]
    .map(([contractType, v]) => ({
      contractType,
      totalHours: round2(v.hours),
      totalCost: round2(v.cost),
    }))
    .sort((a, b) => a.contractType.localeCompare(b.contractType))

  const contractTypeByDay = [...dayMap.values()]
    .map((d) => ({
      date: d.date,
      contractType: d.contractType,
      workerCount: d.workerIds.size,
      totalHours: round2(d.hours),
      totalCost: round2(d.cost),
    }))
    .sort((a, b) => a.contractType.localeCompare(b.contractType) || a.date.localeCompare(b.date))

  return { hoursCostByContractType, contractTypeByDay }
}

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

  const productivityByLocationDay: DailyOpsLaborMetricsDto['productivityByLocationDay'] = []
  const byLoc = new Map<string, { locationName: string; rows: { date: string; rev: number; hours: number }[] }>()
  for (const doc of rows.labor) {
    const rev = revByDateLocation.get(`${doc.businessDate}|${doc.locationId}`) ?? 0
    const hours = Number(doc.totals?.hours ?? 0)
    let loc = byLoc.get(doc.locationId)
    if (!loc) {
      loc = { locationName: doc.locationName, rows: [] }
      byLoc.set(doc.locationId, loc)
    }
    loc.rows.push({ date: doc.businessDate, rev, hours })
  }
  for (const [locationId, loc] of byLoc) {
    const scored = loc.rows
      .filter((r) => r.hours > 0)
      .map((r) => ({
        date: r.date,
        revenue: round2(r.rev),
        hours: round2(r.hours),
        revenuePerLaborHour: round2(r.rev / r.hours),
      }))
    scored.sort((a, b) => b.revenuePerLaborHour - a.revenuePerLaborHour)
    productivityByLocationDay.push({
      locationId,
      locationName: loc.locationName,
      highest: scored[0]
        ? {
            date: scored[0].date,
            revenuePerLaborHour: scored[0].revenuePerLaborHour,
            revenue: scored[0].revenue,
            hours: scored[0].hours,
          }
        : null,
      lowest:
        scored.length > 1
          ? {
              date: scored[scored.length - 1]!.date,
              revenuePerLaborHour: scored[scored.length - 1]!.revenuePerLaborHour,
              revenue: scored[scored.length - 1]!.revenue,
              hours: scored[scored.length - 1]!.hours,
            }
          : null,
    })
  }

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
    productivityByLocationDay,
  }
}
