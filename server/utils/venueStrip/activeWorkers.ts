/**
 * @registry-id: dailyOpsVenueStripActiveWorkers
 * @created: 2026-06-09T16:00:00.000Z
 * @last-modified: 2026-06-09T20:00:00.000Z
 * @description: Open-register active staff from Eitje check_ins (live clock-in + loaded cost)
 * @last-fix: [2026-06-09] Loaded employer cost from members cost_per_hour
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/utils/venueStrip/snapshotBatch.ts
 */

import type { VenueStripActiveWorkersDto } from '~/types/daily-ops-dashboard'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { elapsedOpenShiftHours, loadedCostFromCph } from '~/utils/dailyOpsOpenShiftLabor'
import type { MemberCompensationLookup } from '../eitjeAggCompensationEnrich'
import { resolveMemberCompensationHit } from '../eitjeAggCompensationEnrich'
import type { CheckInRow } from './checkIns'

const AMSTERDAM_TZ = 'Europe/Amsterdam'

function formatAmsterdamTime(value: Date | null | undefined): string | undefined {
  if (!value || Number.isNaN(value.getTime())) return undefined
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: AMSTERDAM_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function workerDedupKey(userId: string, userName: string, teamName: string): string {
  return `${userId}|${userName.trim().toLowerCase()}|${teamName.trim().toLowerCase()}`
}

/** Active = Eitje check_ins on the open register business day (start_datetime, no end). */
export function buildVenueActiveWorkers(
  locationId: string,
  businessDate: string,
  checkInRows: CheckInRow[],
  memberComp?: MemberCompensationLookup,
): VenueStripActiveWorkersDto {
  const empty: VenueStripActiveWorkersDto = { workers: 0, rows: [] }
  if (businessDate !== amsterdamOpenRegisterBusinessDateYmd()) return empty

  const now = new Date()
  const seen = new Set<string>()
  const rows: VenueStripActiveWorkersDto['rows'] = []

  for (const row of checkInRows) {
    if (row.locationId !== locationId) continue
    const key = workerDedupKey(row.userId, row.userName, row.teamName)
    if (seen.has(key)) continue
    const hoursWorked = elapsedOpenShiftHours(row.checkInStart, now)
    if (hoursWorked <= 0) continue
    seen.add(key)
    const comp = memberComp
      ? resolveMemberCompensationHit(row.userId, row.userName, memberComp)
      : undefined
    const wages = loadedCostFromCph(hoursWorked, comp?.costPerHour ?? 0)
    rows.push({
      userId: row.userId,
      userName: row.userName,
      teamName: row.teamName,
      startLabel: formatAmsterdamTime(row.checkInStart) ?? '—',
      hoursWorked,
      wages,
    })
  }

  rows.sort(
    (a, b) =>
      a.teamName.localeCompare(b.teamName, 'nl') ||
      a.userName.localeCompare(b.userName, 'nl'),
  )

  return { workers: rows.length, rows }
}
