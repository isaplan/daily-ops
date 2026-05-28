/**
 * @registry-id: dailyOpsDashboardBundleRevLabMaps
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Revenue/labor day maps from snapshot rows (master gap-fill)
 * @adr-ref: ADR-004
 */

import type {
  DailyOpsSnapshotLaborSection,
  DailyOpsSnapshotMaster,
  DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import { headlineExVatFromSnapshotSection } from '../snapshotHeadlineRevenue'
import { locDayKey } from './shared'

export function buildRevLabMaps(
  masters: DailyOpsSnapshotMaster[],
  revenue: DailyOpsSnapshotRevenueSection[],
  labor: DailyOpsSnapshotLaborSection[],
): {
  revMap: Map<string, number>
  labMap: Map<string, { laborCost: number; hours: number; distinctWorkerCount: number }>
  revByDateLocation: Map<string, number>
} {
  const revByDateLocation = new Map<string, number>()
  const labByLocDay = new Map<string, { laborCost: number; hours: number; workerIds: Set<string> }>()

  for (const r of revenue) {
    revByDateLocation.set(locDayKey(r.businessDate, r.locationId), headlineExVatFromSnapshotSection(r))
  }
  for (const m of masters) {
    const key = locDayKey(m.businessDate, m.locationId)
    if (!revByDateLocation.has(key)) {
      revByDateLocation.set(key, Number(m.cards?.revenue?.ex_vat ?? 0))
    }
  }

  for (const l of labor) {
    const key = locDayKey(l.businessDate, l.locationId)
    const workerIds = new Set((l.workers ?? []).map((w) => w.userId).filter(Boolean))
    labByLocDay.set(key, {
      laborCost: Number(l.totals?.loaded_cost ?? 0),
      hours: Number(l.totals?.hours ?? 0),
      workerIds,
    })
  }
  for (const m of masters) {
    const key = locDayKey(m.businessDate, m.locationId)
    if (!labByLocDay.has(key)) {
      labByLocDay.set(key, {
        laborCost: Number(m.cards?.labor?.loaded_cost ?? 0),
        hours: Number(m.cards?.labor?.hours ?? 0),
        workerIds: new Set(),
      })
    }
  }

  const revMap = new Map<string, number>()
  for (const [key, amount] of revByDateLocation) {
    const day = key.split('|')[0] ?? key
    revMap.set(day, (revMap.get(day) ?? 0) + amount)
  }

  const labMap = new Map<string, { laborCost: number; hours: number; distinctWorkerCount: number }>()
  for (const [key, lab] of labByLocDay) {
    const day = key.split('|')[0] ?? key
    const prev = labMap.get(day)
    if (prev) {
      labMap.set(day, {
        laborCost: prev.laborCost + lab.laborCost,
        hours: prev.hours + lab.hours,
        distinctWorkerCount: prev.distinctWorkerCount + lab.workerIds.size,
      })
    } else {
      labMap.set(day, {
        laborCost: lab.laborCost,
        hours: lab.hours,
        distinctWorkerCount: lab.workerIds.size,
      })
    }
  }

  return { revMap, labMap, revByDateLocation }
}

export function buildHeadlineRevenueByLocDay(
  revenue: DailyOpsSnapshotRevenueSection[],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const rev of revenue) {
    out.set(locDayKey(rev.businessDate, rev.locationId), headlineExVatFromSnapshotSection(rev))
  }
  return out
}
