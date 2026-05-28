/**
 * @registry-id: dailyOpsDashboardBundleLaborContractRollups
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Contract-type hour/cost rollups from snapshot labor sections
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/dashboardBundle/assembleLaborDto.ts
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { DailyOpsLaborMetricsDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsSnapshotLaborSection } from '~/types/daily-ops-snapshot'
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
