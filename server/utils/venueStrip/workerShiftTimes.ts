/**
 * @registry-id: dailyOpsVenueStripWorkerShiftTimes
 * @created: 2026-06-07T00:00:00.000Z
 * @last-modified: 2026-06-08T00:00:00.000Z
 * @description: Shift start/end labels for venue-strip KPI staff drawers (Eitje raw + inbox fallback)
 * @last-fix: [2026-06-09] Active shift = end missing or end in future (Eitje planned end ≠ clock-out)
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/venueStrip/labor.ts
 */

import { ObjectId, type Db } from 'mongodb'
import type { VenueStripWorkerLineDto } from '~/types/daily-ops-dashboard'
import { amsterdamOpenRegisterBusinessDateYmd, calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'
import { isEitjeShiftClockedOut } from '~/utils/dailyOpsOpenShiftLabor'
import { VENUE_STRIP_LOCATIONS } from './constants'

const AMSTERDAM_TZ = 'Europe/Amsterdam'

type ShiftSlot = {
  startAt: Date | null
  endAt: Date | null
  hasRawEnd: boolean
}

type ShiftRow = {
  locationId: string
  userId: string
  userName: string
  teamName: string
  /** Eitje `type.name` e.g. gewerkte_uren, ziek, verlof. */
  shiftType: string
  shiftStart: Date | null
  shiftEnd: Date | null
  hasRawEnd: boolean
  hours: number
}

/** Exported for open-shift labor overlay on today's venue strip GET. */
export type EitjeShiftRow = ShiftRow

function formatAmsterdamTime(value: Date | null | undefined): string | undefined {
  if (!value || Number.isNaN(value.getTime())) return undefined
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: AMSTERDAM_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function normName(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim().toLowerCase()
}

function normTeam(team: string): string {
  return normName(team)
}

function resolveLookupTeam(teamName: string): string {
  const n = normTeam(teamName)
  if (n.includes('afwas')) return 'afwas'
  return n
}

function workerTeamKey(locationId: string, userId: string, teamName: string): string {
  return `${locationId}|${userId}|${normTeam(teamName)}`
}

function workerNameKey(locationId: string, userName: string, teamName: string): string {
  return `${locationId}|name:${normName(userName)}|${normTeam(teamName)}`
}

function mergeShiftSlot(target: ShiftSlot, incoming: ShiftSlot): void {
  if (incoming.startAt) {
    if (!target.startAt || incoming.startAt.getTime() < target.startAt.getTime()) {
      target.startAt = incoming.startAt
    }
  }
  if (incoming.hasRawEnd && incoming.endAt) {
    if (!target.endAt || incoming.endAt.getTime() > target.endAt.getTime()) {
      target.endAt = incoming.endAt
      target.hasRawEnd = true
    }
  }
}

function slotFromRow(row: ShiftRow): ShiftSlot {
  return {
    startAt: row.shiftStart,
    endAt: row.hasRawEnd ? row.shiftEnd : null,
    hasRawEnd: row.hasRawEnd,
  }
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

function parseInboxTimeOnDate(businessDate: string, raw: unknown): Date | null {
  if (raw == null) return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
  const text = String(raw).trim()
  if (!text) return null
  const hhmm = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (hhmm) {
    const hour = Number(hhmm[1])
    const minute = Number(hhmm[2])
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    const baseMs = Date.parse(`${businessDate}T00:00:00.000Z`)
    for (let offsetH = -4; offsetH <= 28; offsetH += 1) {
      const probe = new Date(baseMs + offsetH * 3600000)
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: AMSTERDAM_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const parts = fmt.formatToParts(probe)
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
      const ymd = `${get('year')}-${get('month')}-${get('day')}`
      if (ymd === businessDate && Number(get('hour')) === hour && Number(get('minute')) === minute) {
        return probe
      }
    }
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function locationNameById(locationId: string): string {
  return VENUE_STRIP_LOCATIONS.find((v) => v.locationId === locationId)?.locationName ?? locationId
}

/** Inbox `date` is Amsterdam calendar midnight stored as prior UTC evening (see debug-labor-yesterday.ts). */
function inboxStoredDateForBusinessDate(businessDate: string): Date {
  const [y, m, d] = businessDate.split('-').map(Number)
  const inboxDate = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
  inboxDate.setUTCHours(inboxDate.getUTCHours() - 2)
  return inboxDate
}

function toDate(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function shiftStartFromRaw(raw: Record<string, unknown>): Date | null {
  return (
    toDate(raw.start) ??
    toDate(raw.start_time) ??
    toDate(raw.started_at) ??
    toDate(raw.from) ??
    null
  )
}

function shiftEndFromRaw(raw: Record<string, unknown>): Date | null {
  return (
    toDate(raw.end) ??
    toDate(raw.end_time) ??
    toDate(raw.ended_at) ??
    toDate(raw.to) ??
    null
  )
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

async function fetchEitjeShiftRows(
  db: Db,
  businessDate: string,
  locationIds: string[],
): Promise<ShiftRow[]> {
  const startD = dayStartUtc(businessDate)
  const endD = dayEndUtc(businessDate)
  const looseStart = addUtcDays(startD, -1)
  const looseEnd = addUtcDays(endD, 1)
  const locationIdSet = new Set(locationIds)
  const envToLocation = await loadEitjeEnvToLocationId(db, locationIds)

  const docs = await db
    .collection('eitje_raw_data')
    .find({
      endpoint: 'time_registration_shifts',
      date: { $gte: looseStart, $lte: looseEnd },
    })
    .project({ rawApiResponse: 1, extracted: 1, environmentId: 1 })
    .toArray()

  const rows: ShiftRow[] = []
  for (const doc of docs) {
    const raw = (doc.rawApiResponse ?? {}) as Record<string, unknown>
    const extracted = (doc.extracted ?? {}) as Record<string, unknown>
    const shiftStart = shiftStartFromRaw(raw)
    if (!shiftStart) continue
    const period = calendarYmdInAmsterdam(shiftStart)
    if (period !== businessDate) continue

    const environmentId = String(
      doc.environmentId ??
        extracted.environmentId ??
        raw.environment_id ??
        raw.environmentId ??
        (raw.environment as { id?: unknown } | undefined)?.id ??
        '',
    )
    const locationId = envToLocation.get(environmentId)
    if (!locationId || !locationIdSet.has(locationId)) continue

    const rawEnd = shiftEndFromRaw(raw)
    const now = new Date()
    const clockedOut = isEitjeShiftClockedOut(rawEnd, now)
    rows.push({
      locationId,
      userId: String(extracted.userId ?? raw.user_id ?? (raw.user as { id?: unknown } | undefined)?.id ?? ''),
      userName: String(raw.user_name ?? (raw.user as { name?: unknown } | undefined)?.name ?? extracted.userName ?? ''),
      teamName: String((raw.team as { name?: unknown } | undefined)?.name ?? raw.team_name ?? extracted.teamName ?? ''),
      shiftType: String((raw.type as { name?: unknown } | undefined)?.name ?? ''),
      shiftStart,
      shiftEnd: clockedOut ? rawEnd : null,
      hasRawEnd: clockedOut,
      hours: Number(extracted.hours ?? raw.hours ?? raw.hours_worked ?? 0),
    })
  }
  return rows
}

function buildShiftMap(rows: ShiftRow[]): Map<string, ShiftSlot> {
  const out = new Map<string, ShiftSlot>()
  for (const row of rows) {
    const slot = slotFromRow(row)
    if (!slot.startAt && !slot.hasRawEnd) continue
    const keys = [
      workerTeamKey(row.locationId, row.userId, row.teamName),
      row.userId ? workerTeamKey(row.locationId, row.userId, resolveLookupTeam(row.teamName)) : null,
      workerNameKey(row.locationId, row.userName, row.teamName),
    ].filter((k): k is string => Boolean(k))
    for (const key of keys) {
      const prev = out.get(key) ?? { startAt: null, endAt: null, hasRawEnd: false }
      mergeShiftSlot(prev, slot)
      out.set(key, prev)
    }
  }
  return out
}

async function fetchInboxShiftFallback(
  db: Db,
  businessDate: string,
  locationIds: string[],
): Promise<Map<string, ShiftSlot>> {
  const locationNames = locationIds.map((id) => locationNameById(id))
  const inboxDate = inboxStoredDateForBusinessDate(businessDate)
  const docs = await db
    .collection('inbox-eitje-hours')
    .find({
      cron_hour: { $in: [7, 8] },
      date: inboxDate,
      location_name: { $in: locationNames },
    })
    .project({
      location_name: 1,
      employee_name: 1,
      team_name: 1,
      support_id: 1,
      hours: 1,
      planned_start_time: 1,
      planned_end_time: 1,
    })
    .toArray()

  const out = new Map<string, ShiftSlot>()
  for (const doc of docs) {
    const locationName = String(doc.location_name ?? '')
    const location = VENUE_STRIP_LOCATIONS.find((v) => normName(v.locationName) === normName(locationName))
    if (!location) continue

    const teamName = String(doc.team_name ?? '')
    const employeeName = String(doc.employee_name ?? '')
    const startAt =
      parseInboxTimeOnDate(businessDate, doc.planned_start_time) ??
      parseInboxTimeOnDate(businessDate, (doc as Record<string, unknown>).geplande_starttijd)
    let endAt =
      parseInboxTimeOnDate(businessDate, doc.planned_end_time) ??
      parseInboxTimeOnDate(businessDate, (doc as Record<string, unknown>).geplande_eindttijd) ??
      parseInboxTimeOnDate(businessDate, (doc as Record<string, unknown>).geplande_eindtijd)

    const hours = Number(doc.hours ?? 0)
    if (!endAt && startAt && hours > 0) {
      endAt = new Date(startAt.getTime() + hours * 3600000)
    }

    if (!startAt && !endAt) continue

    const slot: ShiftSlot = {
      startAt,
      endAt,
      hasRawEnd: endAt != null,
    }

    const supportId = String(doc.support_id ?? '').trim()
    const keys = [
      supportId ? workerTeamKey(location.locationId, supportId, teamName) : null,
      workerNameKey(location.locationId, employeeName, teamName),
      workerNameKey(location.locationId, employeeName, resolveLookupTeam(teamName)),
    ].filter((k): k is string => Boolean(k))

    for (const key of keys) {
      const prev = out.get(key) ?? { startAt: null, endAt: null, hasRawEnd: false }
      mergeShiftSlot(prev, slot)
      out.set(key, prev)
    }
  }
  return out
}

export function findShiftSlot(
  eitjeMap: Map<string, ShiftSlot>,
  inboxMap: Map<string, ShiftSlot>,
  locationId: string,
  userId: string,
  userName: string,
  teamName: string,
): { eitje?: ShiftSlot; inbox?: ShiftSlot } {
  const team = resolveLookupTeam(teamName)
  const keys = [
    workerTeamKey(locationId, userId, teamName),
    userId ? workerTeamKey(locationId, userId, team) : null,
    workerNameKey(locationId, userName, teamName),
    workerNameKey(locationId, userName, team),
  ].filter((k): k is string => Boolean(k))

  let eitje: ShiftSlot | undefined
  let inbox: ShiftSlot | undefined
  for (const key of keys) {
    eitje ??= eitjeMap.get(key)
    inbox ??= inboxMap.get(key)
  }
  return { eitje, inbox }
}

function labelsFromSlot(
  slot: ShiftSlot | undefined,
  fallback: ShiftSlot | undefined,
  workerHours: number,
  allowOpenEnd: boolean,
): { startLabel?: string; endLabel?: string } {
  const startAt = slot?.startAt ?? fallback?.startAt ?? null
  let endAt: Date | null = null

  if (slot?.hasRawEnd && slot.endAt) {
    endAt = slot.endAt
  } else if (!allowOpenEnd) {
    endAt = fallback?.endAt ?? null
    if (!endAt && startAt && workerHours > 0) {
      endAt = new Date(startAt.getTime() + workerHours * 3600000)
    }
  }

  return {
    startLabel: formatAmsterdamTime(startAt),
    endLabel: endAt ? formatAmsterdamTime(endAt) : undefined,
  }
}

export type WorkerShiftTimeMaps = {
  eitje: Map<string, ShiftSlot>
  inbox: Map<string, ShiftSlot>
  eitjeRows: EitjeShiftRow[]
}

export async function fetchWorkerShiftTimeMaps(
  db: Db,
  businessDate: string,
  locationIds: string[],
): Promise<WorkerShiftTimeMaps> {
  const allowOpenEnd = businessDate >= amsterdamOpenRegisterBusinessDateYmd()
  const [eitjeRows, inboxMap] = await Promise.all([
    fetchEitjeShiftRows(db, businessDate, locationIds),
    allowOpenEnd ? Promise.resolve(new Map<string, ShiftSlot>()) : fetchInboxShiftFallback(db, businessDate, locationIds),
  ])
  return { eitje: buildShiftMap(eitjeRows), inbox: inboxMap, eitjeRows }
}

export function enrichWorkersWithShiftTimesFromMaps(
  workers: VenueStripWorkerLineDto[],
  locationId: string,
  businessDate: string,
  maps: { eitje: Map<string, ShiftSlot>; inbox: Map<string, ShiftSlot> },
): VenueStripWorkerLineDto[] {
  if (workers.length === 0) return workers
  const allowOpenEnd = businessDate >= amsterdamOpenRegisterBusinessDateYmd()

  return workers.map((worker) => {
    const { eitje, inbox } = findShiftSlot(
      maps.eitje,
      maps.inbox,
      locationId,
      worker.userId,
      worker.userName,
      worker.teamName,
    )
    const { startLabel, endLabel } = labelsFromSlot(eitje, inbox, worker.hours, allowOpenEnd)
    return { ...worker, startLabel, endLabel }
  })
}

export async function enrichWorkersWithShiftTimes(
  db: Db,
  workers: VenueStripWorkerLineDto[],
  locationId: string,
  businessDate: string,
  maps?: { eitje: Map<string, ShiftSlot>; inbox: Map<string, ShiftSlot> },
): Promise<VenueStripWorkerLineDto[]> {
  if (workers.length === 0) return workers
  const resolved =
    maps ?? (await fetchWorkerShiftTimeMaps(db, businessDate, [locationId]))
  return enrichWorkersWithShiftTimesFromMaps(workers, locationId, businessDate, resolved)
}
