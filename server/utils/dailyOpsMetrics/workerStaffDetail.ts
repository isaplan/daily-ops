/**
 * @registry-id: dailyOpsMetricsWorkerStaffDetail
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Worker staff detail drawer from period-cache staff.workers + day revenue
 * @last-fix: [2026-08-09] ZERO GET — period-cache only (no live Eitje agg / snapshot)
 * @adr-ref: ADR-004, PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsDashboardMetrics.ts (barrel)
 * ✓ server/api/daily-ops/metrics/worker-staff-detail.get.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsWorkerStaffDetailDto } from '~/types/daily-ops-dashboard'
import { loadPeriodDayNodesForRange } from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'
import {
  buildWorkerContractIndex,
  enrichLaborWorkersFromMembers,
} from '../dailyOpsStaff/resolveWorkerContractFromMembers'
import type { DailyOpsMetricsContext } from './context'

const LOC_DAY_KEY_SEP = '\x1f'

export function locationDayKey (date: string, locationId: string): string {
  return `${date}${LOC_DAY_KEY_SEP}${String(locationId)}`
}

export type WorkerStaffDetailRow = {
  date: string
  locationId: string
  locationName: string
  teamId: string
  teamName: string
  userId: string
  staffName: string
  contractType: string
  totalHours: number
  totalCost: number
}

function buildWorkerStaffDetailDto (
  workerStaffDetailRaw: WorkerStaffDetailRow[],
  revByDateLocation: Map<string, number>,
): DailyOpsWorkerStaffDetailDto[] {
  const teamDayHours = new Map<string, number>()
  for (const row of workerStaffDetailRaw) {
    const k = `${row.date}|${row.locationId}|${row.teamId}`
    teamDayHours.set(k, (teamDayHours.get(k) ?? 0) + row.totalHours)
  }

  return workerStaffDetailRaw.map((row) => {
    const locK = locationDayKey(row.date, row.locationId)
    const rev = revByDateLocation.get(locK) ?? 0
    const teamH =
      teamDayHours.get(`${row.date}|${row.locationId}|${row.teamId}`) ?? row.totalHours
    let laborCostPctOfRevenue: number | null = null
    if (rev > 0 && teamH > 0) {
      const attributedRev = rev * (row.totalHours / teamH)
      if (attributedRev > 0) {
        laborCostPctOfRevenue = Math.round((row.totalCost / attributedRev) * 100 * 10) / 10
      }
    }
    return { ...row, laborCostPctOfRevenue }
  })
}

export async function fetchWorkerStaffDetailMetrics (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsWorkerStaffDetailDto[]> {
  const locationId = ctx.locationId ?? 'all'
  const [nodes, contractIndex] = await Promise.all([
    loadPeriodDayNodesForRange(db, {
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      locationId,
    }),
    buildWorkerContractIndex(db),
  ])

  const revByDateLocation = new Map<string, number>()
  const rows: WorkerStaffDetailRow[] = []

  for (const n of nodes) {
    // Prefer venue child keys when reading "all" — use node itself for single venue.
    if (n.locationId === 'all' && locationId === 'all') {
      // Combined day node has workers but may lack per-venue attribution; still usable.
    }
    revByDateLocation.set(locationDayKey(n.periodKey, n.locationId), Number(n.revenue.exVat ?? 0))

    const pseudoWorkers = (n.staff.workers ?? []).map((w) => ({
      userId: w.memberId,
      userName: w.memberId,
      teamId: w.team,
      teamName: w.team,
      hours: w.hours,
      wage_cost: w.wage,
      loaded_cost: w.wage,
      contractType: '',
      hourly_rate: null,
      cost_per_hour: null,
      loaded_cost_fallback: false,
    })) as NonNullable<import('~/types/daily-ops-snapshot').DailyOpsSnapshotLaborSection['workers']>
    const enriched = enrichLaborWorkersFromMembers(pseudoWorkers, contractIndex)
    for (const w of enriched) {
      const userId = String(w.userId ?? '').trim()
      if (!userId || Number(w.hours ?? 0) <= 0) continue
      rows.push({
        date: n.periodKey,
        locationId: n.locationId,
        locationName: n.locationName,
        teamId: String(w.teamId ?? w.teamName ?? ''),
        teamName: String(w.teamName ?? ''),
        userId,
        staffName: String(w.userName ?? userId),
        contractType: String(w.contractType ?? '-'),
        totalHours: Math.round(Number(w.hours ?? 0) * 100) / 100,
        totalCost: Math.round(Number(w.wage_cost ?? w.loaded_cost ?? 0) * 100) / 100,
      })
    }
  }

  rows.sort((a, b) =>
    a.date.localeCompare(b.date)
    || a.locationName.localeCompare(b.locationName)
    || a.teamName.localeCompare(b.teamName)
    || a.staffName.localeCompare(b.staffName),
  )

  return buildWorkerStaffDetailDto(rows, revByDateLocation)
}
