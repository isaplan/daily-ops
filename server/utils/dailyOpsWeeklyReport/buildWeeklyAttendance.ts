/**
 * @registry-id: dailyOpsWeeklyReportBuildAttendance
 * @created: 2026-07-09T12:00:00.000Z
 * @last-modified: 2026-08-09T17:55:00.000Z
 * @description: Weekly ziek + verlof rollups — RETIRED from GET (Eitje); period-cache gap zeros
 * @last-fix: [2026-08-09] Not called from weekly/monthly digest GET (ZERO-GET)
 * @adr-ref: PERIOD_CACHE_ADR L2, ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ (unused on GET — keep until attendance sealed onto period nodes)
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsAttendanceStaffRowDto,
  DailyOpsAttendanceVenueDto,
} from '~/types/daily-ops-dashboard'
import type { WeeklyAttendanceStaffRow, WeeklyAttendanceSummary } from '~/types/daily-ops-weekly-report'
import { EITJE_VERLOF_VAKANTIE_TEAM_REGEX } from '../eitjeAbsenceTeams'
import { fetchDailyOpsAttendanceKpis } from '../dailyOpsAttendanceKpis'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function flattenRows(
  venues: DailyOpsAttendanceVenueDto[],
  locationId: string,
): DailyOpsAttendanceStaffRowDto[] {
  const rows: DailyOpsAttendanceStaffRowDto[] = []
  for (const venue of venues) {
    if (locationId !== 'all' && venue.locationId !== locationId) continue
    rows.push(...venue.rows)
  }
  return rows
}

function dedupeStaffRows(rows: DailyOpsAttendanceStaffRowDto[]): WeeklyAttendanceStaffRow[] {
  const byUser = new Map<string, WeeklyAttendanceStaffRow>()
  for (const row of rows) {
    const key = row.userId?.trim() || row.userName.trim() || 'unknown'
    const prev = byUser.get(key) ?? {
      userId: row.userId ?? key,
      userName: row.userName,
      teamName: row.teamName ?? '—',
      hours: 0,
    }
    prev.hours = round2(prev.hours + row.hours)
    if (row.teamName && row.teamName !== '—') prev.teamName = row.teamName
    byUser.set(key, prev)
  }
  return [...byUser.values()].sort((a, b) => b.hours - a.hours || a.userName.localeCompare(b.userName))
}

/** Sum registered Vakantie / Verlof uren for the ISO week (Eitje hours dashboard SSOT). */
async function buildWeeklyVerlofStaff(
  db: Db,
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<WeeklyAttendanceStaffRow[]> {
  const locationIds =
    locationId === 'all'
      ? VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
      : [locationId]

  const docs = await db
    .collection('eitje_time_registration_aggregation')
    .find({
      period_type: 'day',
      period: { $gte: startDate, $lte: endDate },
      locationId: { $in: locationIds },
      team_name: EITJE_VERLOF_VAKANTIE_TEAM_REGEX,
    })
    .project({ userId: 1, user_name: 1, team_name: 1, total_hours: 1 })
    .toArray()

  const rows: DailyOpsAttendanceStaffRowDto[] = docs.map((d) => ({
    userId: String((d as Record<string, unknown>).userId ?? ''),
    userName: String((d as Record<string, unknown>).user_name ?? 'Unknown'),
    teamName: String((d as Record<string, unknown>).team_name ?? 'Verlof'),
    hours: round2(Number((d as Record<string, unknown>).total_hours ?? 0)),
  }))

  return dedupeStaffRows(rows).filter((r) => r.hours > 0)
}

export async function buildWeeklyAttendance(
  db: Db,
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<WeeklyAttendanceSummary> {
  const kpis = await fetchDailyOpsAttendanceKpis(db, {
    period: 'last-week',
    startDate,
    endDate,
    locationId: locationId === 'all' ? undefined : locationId,
  })

  const sickRows = flattenRows(kpis.sick.venues, locationId)
  const ziekStaff = dedupeStaffRows(sickRows)
  const verlofStaff = await buildWeeklyVerlofStaff(db, startDate, endDate, locationId)

  return {
    ziekHours: round2(ziekStaff.reduce((s, r) => s + r.hours, 0)),
    ziekStaffCount: ziekStaff.length,
    verlofStaffCount: verlofStaff.length,
    verlofHours: round2(verlofStaff.reduce((s, r) => s + r.hours, 0)),
    ziekStaff,
    verlofStaff,
  }
}
