/**
 * @registry-id: dailyOpsStaffFetchDailyLabor
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Daily labor + headcount from period-cache day nodes (GET)
 * @last-fix: [2026-08-09] ZERO GET — period-cache only; miss → [] (no snapshot)
 *   Prior: [2026-06-29] Overlay members contract on snapshot workers missing contractType
 * @adr-ref: ADR-004, ADR-006, PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsStaff/fetchStaffTimeseries.ts
 * ✓ server/utils/dailyOpsStaff/computeStaffRollingMedians.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsSnapshotLaborSection } from '~/types/daily-ops-snapshot'
import type { DailyOpsPeriodNode } from '~/types/daily-ops-period-cache'
import {
  classifyStaffContractType,
  emptyStaffContractBuckets,
  type StaffContractBuckets,
} from '~/utils/dailyOpsStaffContractBuckets'
import {
  buildWorkerContractIndex,
  enrichLaborWorkersFromMembers,
} from './resolveWorkerContractFromMembers'
import { loadPeriodDayNodesForRange } from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'

export type StaffDailyLaborRow = {
  date: string
  locationId: string
  locationName: string
  hours: number
  gewerkt_hours: number
  staff_count: number
  workerIds: string[]
  labor_loaded_cost: number
  byContract: StaffContractBuckets
  contractWorkerIds: Record<'ft' | 'pt' | 'zzp', string[]>
  teams: Array<{
    teamName: string
    hours: number
    gewerkt_hours: number
    staff_count: number
    workerIds: string[]
    byContract: StaffContractBuckets
    contractWorkerIds: Record<'ft' | 'pt' | 'zzp', string[]>
  }>
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function workerKey(w: { userId?: string; userName?: string }): string {
  return String(w.userId ?? w.userName ?? '').trim()
}

function collectWorkerIds(
  workers: DailyOpsSnapshotLaborSection['workers'] | undefined,
): string[] {
  if (!Array.isArray(workers)) return []
  const ids = new Set<string>()
  for (const w of workers) {
    if (Number(w.hours ?? 0) <= 0) continue
    const id = workerKey(w)
    if (id) ids.add(id)
  }
  return [...ids]
}

function buildContractBuckets(
  workers: DailyOpsSnapshotLaborSection['workers'] | undefined,
  dayGewerkt: number,
): { buckets: StaffContractBuckets; workerIds: Record<'ft' | 'pt' | 'zzp', string[]> } {
  const buckets = emptyStaffContractBuckets()
  const ids: Record<'ft' | 'pt' | 'zzp', Set<string>> = {
    ft: new Set(),
    pt: new Set(),
    zzp: new Set(),
  }

  if (!Array.isArray(workers)) {
    return {
      buckets,
      workerIds: { ft: [], pt: [], zzp: [] },
    }
  }

  for (const w of workers) {
    const h = Number(w.hours ?? 0)
    if (h <= 0) continue
    const bucket = classifyStaffContractType(String(w.contractType ?? ''))
    if (!bucket) continue
    buckets[bucket].hours += h
    buckets[bucket].loaded_cost += Number(w.loaded_cost ?? 0)
    const id = workerKey(w)
    if (id) ids[bucket].add(id)
  }

  const totalHours = buckets.ft.hours + buckets.pt.hours + buckets.zzp.hours
  const workerIds = { ft: [...ids.ft], pt: [...ids.pt], zzp: [...ids.zzp] }
  for (const key of ['ft', 'pt', 'zzp'] as const) {
    buckets[key].hours = round2(buckets[key].hours)
    buckets[key].staff_count = ids[key].size
    buckets[key].loaded_cost = round2(buckets[key].loaded_cost)
    buckets[key].gewerkt_hours =
      totalHours > 0 ? round2(dayGewerkt * (buckets[key].hours / totalHours)) : 0
  }

  return { buckets, workerIds }
}

function collectTeamWorkerIds(
  workers: DailyOpsSnapshotLaborSection['workers'] | undefined,
  teamName: string,
): string[] {
  if (!Array.isArray(workers)) return []
  const norm = teamName.trim().toLowerCase()
  const ids = new Set<string>()
  for (const w of workers) {
    if (Number(w.hours ?? 0) <= 0) continue
    if ((w.teamName ?? '').trim().toLowerCase() !== norm) continue
    const id = workerKey(w)
    if (id) ids.add(id)
  }
  return [...ids]
}

function buildTeamContractFromWorkers(
  workers: DailyOpsSnapshotLaborSection['workers'] | undefined,
  teamName: string,
  teamGewerkt: number,
): { buckets: StaffContractBuckets; workerIds: Record<'ft' | 'pt' | 'zzp', string[]> } {
  const buckets = emptyStaffContractBuckets()
  const ids: Record<'ft' | 'pt' | 'zzp', Set<string>> = {
    ft: new Set(),
    pt: new Set(),
    zzp: new Set(),
  }
  if (!Array.isArray(workers)) {
    return { buckets, workerIds: { ft: [], pt: [], zzp: [] } }
  }
  const norm = teamName.trim().toLowerCase()
  for (const w of workers) {
    const h = Number(w.hours ?? 0)
    if (h <= 0) continue
    if ((w.teamName ?? '').trim().toLowerCase() !== norm) continue
    const bucket = classifyStaffContractType(String(w.contractType ?? ''))
    if (!bucket) continue
    buckets[bucket].hours += h
    buckets[bucket].loaded_cost += Number(w.loaded_cost ?? 0)
    const id = workerKey(w)
    if (id) ids[bucket].add(id)
  }
  const totalHours = buckets.ft.hours + buckets.pt.hours + buckets.zzp.hours
  const workerIds = { ft: [...ids.ft], pt: [...ids.pt], zzp: [...ids.zzp] }
  for (const key of ['ft', 'pt', 'zzp'] as const) {
    buckets[key].hours = round2(buckets[key].hours)
    buckets[key].staff_count = ids[key].size
    buckets[key].loaded_cost = round2(buckets[key].loaded_cost)
    buckets[key].gewerkt_hours =
      totalHours > 0 ? round2(teamGewerkt * (buckets[key].hours / totalHours)) : 0
  }
  return { buckets, workerIds }
}

function countTeamWorkers(
  workers: DailyOpsSnapshotLaborSection['workers'] | undefined,
  teamName: string,
): number {
  return collectTeamWorkerIds(workers, teamName).length
}

function rowsFromPeriodNodes (
  nodes: DailyOpsPeriodNode[],
  contractIndex: Awaited<ReturnType<typeof buildWorkerContractIndex>>,
): StaffDailyLaborRow[] {
  return nodes.map((n) => {
    const pseudoWorkers = (n.staff.workers ?? []).map((w) => ({
      userId: w.memberId,
      userName: w.memberId,
      teamId: '',
      teamName: w.team,
      hours: w.hours,
      wage_cost: w.wage,
      loaded_cost: w.wage,
      contractType: '',
      hourly_rate: null,
      cost_per_hour: null,
      loaded_cost_fallback: false,
    })) as NonNullable<DailyOpsSnapshotLaborSection['workers']>
    const workers = enrichLaborWorkersFromMembers(pseudoWorkers, contractIndex)
    const gewerkt = round2(n.labor.hours)
    const { buckets, workerIds: contractWorkerIds } = buildContractBuckets(workers, gewerkt)
    const workerIds = collectWorkerIds(workers)
    return {
      date: n.periodKey,
      locationId: n.locationId,
      locationName: n.locationName,
      hours: round2(n.labor.hours),
      gewerkt_hours: gewerkt,
      staff_count: workerIds.length || n.labor.staffCount,
      workerIds,
      labor_loaded_cost: round2(n.labor.loadedCost),
      byContract: buckets,
      contractWorkerIds,
      teams: (n.labor.byTeam ?? []).map((t) => {
        const teamName = String(t.team || 'Other')
        const teamWorkerIds = collectTeamWorkerIds(workers, teamName)
        const teamGewerkt = round2(t.hours)
        const { buckets: teamByContract, workerIds: teamContractWorkerIds } =
          buildTeamContractFromWorkers(workers, teamName, teamGewerkt)
        return {
          teamName,
          hours: round2(t.hours),
          gewerkt_hours: teamGewerkt,
          staff_count: teamWorkerIds.length,
          workerIds: teamWorkerIds,
          byContract: teamByContract,
          contractWorkerIds: teamContractWorkerIds,
        }
      }),
    }
  })
}

export async function fetchStaffDailyLaborRows (
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<StaffDailyLaborRow[]> {
  const contractIndex = await buildWorkerContractIndex(db)
  const nodes = await loadPeriodDayNodesForRange(db, {
    startDate,
    endDate,
    locationId: locationId ?? 'all',
  })
  if (nodes.length === 0) return []
  return rowsFromPeriodNodes(nodes, contractIndex)
}
