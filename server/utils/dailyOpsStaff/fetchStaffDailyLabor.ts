/**
 * @registry-id: dailyOpsStaffFetchDailyLabor
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-06-25T12:00:00.000Z
 * @description: Daily labor + headcount from snapshot labor sections (ADR-004)
 * @last-fix: [2026-06-25] Staff totals daily series builder
 * @adr-ref: ADR-004, ADR-006
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsStaff/fetchStaffTimeseries.ts
 * ✓ server/utils/dailyOpsStaff/computeStaffRollingMedians.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsSnapshotLaborSection } from '~/types/daily-ops-snapshot'

export type StaffDailyLaborRow = {
  date: string
  locationId: string
  locationName: string
  hours: number
  gewerkt_hours: number
  staff_count: number
  teams: Array<{ teamName: string; hours: number; gewerkt_hours: number; staff_count: number }>
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function gewerktHours(doc: Pick<DailyOpsSnapshotLaborSection, 'totals_gewerkt' | 'operational' | 'totals'>): number {
  const g = doc.totals_gewerkt?.hours ?? doc.operational?.gewerkt?.hours
  if (g != null && g > 0) return g
  return Number(doc.totals?.hours ?? 0)
}

function teamGewerktHours(team: { hours?: number; gewerkt?: { hours?: number } }): number {
  const g = team.gewerkt?.hours
  if (g != null && g > 0) return g
  return Number(team.hours ?? 0)
}

function countActiveWorkers(
  workers: DailyOpsSnapshotLaborSection['workers'] | undefined,
): number {
  if (!Array.isArray(workers)) return 0
  const ids = new Set<string>()
  for (const w of workers) {
    if (Number(w.hours ?? 0) <= 0) continue
    const id = String(w.userId ?? w.userName ?? '').trim()
    if (id) ids.add(id)
  }
  return ids.size
}

function countTeamWorkers(
  workers: DailyOpsSnapshotLaborSection['workers'] | undefined,
  teamName: string,
): number {
  if (!Array.isArray(workers)) return 0
  const norm = teamName.trim().toLowerCase()
  const ids = new Set<string>()
  for (const w of workers) {
    if (Number(w.hours ?? 0) <= 0) continue
    if ((w.teamName ?? '').trim().toLowerCase() !== norm) continue
    const id = String(w.userId ?? w.userName ?? '').trim()
    if (id) ids.add(id)
  }
  return ids.size
}

export async function fetchStaffDailyLaborRows(
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<StaffDailyLaborRow[]> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: startDate, $lte: endDate },
  }
  if (locationId) filter.locationId = locationId

  const docs = await db
    .collection<DailyOpsSnapshotLaborSection>('daily_ops_snapshot_section_labor')
    .find(filter)
    .project({
      businessDate: 1,
      locationId: 1,
      locationName: 1,
      totals: 1,
      totals_gewerkt: 1,
      operational: 1,
      teams: 1,
      workers: 1,
    })
    .toArray()

  return docs.map((d) => {
    const teams = Array.isArray(d.teams) ? d.teams : []
    return {
      date: String(d.businessDate),
      locationId: String(d.locationId),
      locationName: String(d.locationName ?? d.locationId),
      hours: round2(Number(d.totals?.hours ?? 0)),
      gewerkt_hours: round2(gewerktHours(d)),
      staff_count: countActiveWorkers(d.workers),
      teams: teams.map((t) => ({
        teamName: String(t.teamName ?? 'Other'),
        hours: round2(Number(t.hours ?? 0)),
        gewerkt_hours: round2(teamGewerktHours(t)),
        staff_count: countTeamWorkers(d.workers, String(t.teamName ?? '')),
      })),
    }
  })
}
