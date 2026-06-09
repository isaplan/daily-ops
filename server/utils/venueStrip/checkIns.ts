/**
 * @registry-id: dailyOpsVenueStripCheckIns
 * @created: 2026-06-09T18:00:00.000Z
 * @last-modified: 2026-06-09T18:00:00.000Z
 * @description: Eitje check_ins for Active KPI (live clock-in, start_datetime only)
 * @last-fix: [2026-06-09] Live fetch on open register day + raw fallback from eitje_raw_data
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueStrip.ts
 * ✓ server/utils/venueStrip/activeWorkers.ts
 */

import { ObjectId, type Db } from 'mongodb'
import { loadActiveEitjeCredentials } from '../../services/eitjeSyncService'
import { eitjeFetchJson } from '../../services/eitjeOpenApiFetch'
import { amsterdamOpenRegisterBusinessDateYmd, calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'
import { VENUE_STRIP_LOCATIONS } from './constants'
import { isExcludedFromFloorActive } from './floorActiveFilters'

export type CheckInRow = {
  locationId: string
  userId: string
  userName: string
  teamName: string
  checkInStart: Date
}

function toDate(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function startFromRaw(raw: Record<string, unknown>): Date | null {
  return (
    toDate(raw.start_datetime) ??
    toDate(raw.start) ??
    toDate(raw.start_time) ??
    toDate(raw.started_at) ??
    null
  )
}

function addUtcDays(d: Date, delta: number): Date {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + delta)
  return x
}

function dayStartUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEndUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

async function loadEitjeEnvToLocationId(db: Db, locationIds: string[]): Promise<Map<string, string>> {
  const objectIds = locationIds.flatMap((id) => {
    try {
      return [new ObjectId(id)]
    } catch {
      return []
    }
  })

  const docs = await db
    .collection('unified_location')
    .find({
      $or: [
        { _id: { $in: objectIds } },
        { primaryId: { $in: objectIds } },
        { primaryId: { $in: locationIds } },
      ],
    })
    .project({ primaryId: 1, eitjeIds: 1, _id: 1 })
    .toArray()

  const out = new Map<string, string>()
  for (const doc of docs) {
    const locationId = String(doc.primaryId ?? doc._id ?? '')
    if (!locationId) continue
    for (const eid of (doc.eitjeIds as unknown[] | undefined) ?? []) {
      out.set(String(eid), locationId)
    }
  }
  return out
}

function parseCheckInRecords(
  records: Record<string, unknown>[],
  businessDate: string,
  locationIds: string[],
  envToLocation: Map<string, string>,
): CheckInRow[] {
  const locationIdSet = new Set(locationIds)
  const rows: CheckInRow[] = []

  for (const raw of records) {
    const checkInStart = startFromRaw(raw)
    if (!checkInStart) continue
    if (calendarYmdInAmsterdam(checkInStart) !== businessDate) continue

    const userObj = raw.user && typeof raw.user === 'object' ? (raw.user as Record<string, unknown>) : null
    const teamObj = raw.team && typeof raw.team === 'object' ? (raw.team as Record<string, unknown>) : null
    const envObj = raw.environment && typeof raw.environment === 'object'
      ? (raw.environment as Record<string, unknown>)
      : null

    const environmentId = String(
      raw.environment_id ??
        raw.environmentId ??
        envObj?.id ??
        '',
    )
    const locationId = envToLocation.get(environmentId)
    if (!locationId || !locationIdSet.has(locationId)) continue

    const teamName = String(teamObj?.name ?? raw.team_name ?? '')
    const userName = String(userObj?.name ?? raw.user_name ?? '')
    if (isExcludedFromFloorActive(teamName, '')) continue

    rows.push({
      locationId,
      userId: String(raw.user_id ?? userObj?.id ?? ''),
      userName,
      teamName,
      checkInStart,
    })
  }

  return rows
}

function dedupeCheckInRows(rows: CheckInRow[]): CheckInRow[] {
  const byKey = new Map<string, CheckInRow>()
  for (const row of rows) {
    const key = `${row.locationId}|${row.userId}|${row.userName.trim().toLowerCase()}|${row.teamName.trim().toLowerCase()}`
    const prev = byKey.get(key)
    if (!prev || row.checkInStart.getTime() < prev.checkInStart.getTime()) {
      byKey.set(key, row)
    }
  }
  return [...byKey.values()]
}

async function fetchCheckInRowsFromRaw(
  db: Db,
  businessDate: string,
  locationIds: string[],
): Promise<CheckInRow[]> {
  const startD = dayStartUtc(businessDate)
  const endD = dayEndUtc(businessDate)
  const looseStart = addUtcDays(startD, -1)
  const looseEnd = addUtcDays(endD, 1)
  const envToLocation = await loadEitjeEnvToLocationId(db, locationIds)

  const docs = await db
    .collection('eitje_raw_data')
    .find({
      endpoint: 'check_ins',
      date: { $gte: looseStart, $lte: looseEnd },
    })
    .project({ rawApiResponse: 1, extracted: 1, environmentId: 1 })
    .toArray()

  const records = docs.map((doc) => (doc.rawApiResponse ?? {}) as Record<string, unknown>)
  return dedupeCheckInRows(parseCheckInRecords(records, businessDate, locationIds, envToLocation))
}

async function fetchCheckInsLiveFromApi(
  db: Db,
  businessDate: string,
  locationIds: string[],
): Promise<CheckInRow[]> {
  const creds = await loadActiveEitjeCredentials(db)
  if (!creds) return []

  const res = await eitjeFetchJson(creds, 'check_ins', {
    query: { start_date: businessDate, end_date: businessDate },
  })
  if (!res.ok) return []

  let records: Record<string, unknown>[] = []
  if (Array.isArray(res.data)) {
    records = res.data as Record<string, unknown>[]
  } else if (res.data && typeof res.data === 'object') {
    for (const v of Object.values(res.data as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        records = v as Record<string, unknown>[]
        break
      }
    }
  }

  const envToLocation = await loadEitjeEnvToLocationId(db, locationIds)
  return dedupeCheckInRows(parseCheckInRecords(records, businessDate, locationIds, envToLocation))
}

/** Open register day: live API first; otherwise / fallback raw sync rows. */
export async function fetchVenueStripCheckIns(
  db: Db,
  businessDate: string,
  locationIds: string[] = VENUE_STRIP_LOCATIONS.map((v) => v.locationId),
): Promise<CheckInRow[]> {
  if (businessDate === amsterdamOpenRegisterBusinessDateYmd()) {
    const live = await fetchCheckInsLiveFromApi(db, businessDate, locationIds)
    if (live.length > 0) return live
  }
  return fetchCheckInRowsFromRaw(db, businessDate, locationIds)
}
