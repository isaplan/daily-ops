/**
 * @registry-id: dailyOpsDashboardBundleLaborHourMaps
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Per-location hourly labor maps from snapshot labor sections
 * @adr-ref: ADR-004
 */

import type { DailyOpsSnapshotLaborSection } from '~/types/daily-ops-snapshot'
import { round2 } from './shared'

export type LaborByBusinessDateHourBucket = { loadedCost: number; hours: number }

export function laborByLocHourFromSnapshots(
  labor: DailyOpsSnapshotLaborSection[],
): Map<string, LaborByBusinessDateHourBucket> {
  const out = new Map<string, LaborByBusinessDateHourBucket>()
  for (const doc of labor) {
    for (const slot of doc.hourly ?? []) {
      const h = Number(slot.calendar_hour)
      if (!Number.isFinite(h)) continue
      const key = `${doc.locationId}|${doc.businessDate}|${h}`
      const prev = out.get(key) ?? { loadedCost: 0, hours: 0 }
      out.set(key, {
        loadedCost: round2(prev.loadedCost + Number(slot.loaded_cost ?? 0)),
        hours: round2(prev.hours + Number(slot.hours ?? 0)),
      })
    }
  }
  return out
}

export function laborCostMapFromHourly(
  laborByLocHour: Map<string, LaborByBusinessDateHourBucket>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const [key, row] of laborByLocHour) out.set(key, row.loadedCost)
  return out
}

export function aggregateLaborByDateHour(laborByLocHour: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  for (const [key, cost] of laborByLocHour) {
    const parts = key.split('|')
    if (parts.length < 2) continue
    const hourKey = parts.length >= 3 ? `${parts[1]}|${parts[2]}` : key
    out.set(hourKey, round2((out.get(hourKey) ?? 0) + cost))
  }
  return out
}

export function laborBucketForLocationHour(
  laborByLocHour: Map<string, LaborByBusinessDateHourBucket>,
  locationId: string,
  date: string,
  hour: number,
): LaborByBusinessDateHourBucket {
  return laborByLocHour.get(`${locationId}|${date}|${hour}`) ?? { loadedCost: 0, hours: 0 }
}
