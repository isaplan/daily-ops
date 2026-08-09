/**
 * @registry-id: dailyOpsWeeklyReportBuildOpeningClosing
 * @created: 2026-07-09T15:30:00.000Z
 * @last-modified: 2026-08-09T17:55:00.000Z
 * @description: Weekly pre/post hours — RETIRED from GET (Eitje raw); period-cache gap zeros
 * @last-fix: [2026-08-09] Not called from weekly/monthly digest GET (ZERO-GET)
 * @adr-ref: PERIOD_CACHE_ADR L2, ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ (unused on GET — keep until sealed onto period nodes)
 */

import { ObjectId, type Db } from 'mongodb'
import type { WeeklyOpeningClosingSummary } from '~/types/daily-ops-weekly-report'
import { calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'
import { isEitjeShiftClockedOut } from '~/utils/dailyOpsOpenShiftLabor'
import { DAILY_OPS_VENUE_OPENING_HOURS } from '~/utils/dailyOpsVenueOpeningHours'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  accumulateOpeningClosingShifts,
  type OpeningClosingShiftInput,
} from './openingClosingOverlap'

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

async function fetchEitjeGewerkteShifts(
  db: Db,
  startDate: string,
  endDate: string,
  locationIds: string[],
): Promise<OpeningClosingShiftInput[]> {
  const startD = dayStartUtc(startDate)
  const endD = dayEndUtc(endDate)
  const looseStart = addUtcDays(startD, -1)
  const looseEnd = addUtcDays(endD, 2)
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

  const out: OpeningClosingShiftInput[] = []
  const now = new Date()

  for (const doc of docs) {
    const raw = (doc.rawApiResponse ?? {}) as Record<string, unknown>
    const extracted = (doc.extracted ?? {}) as Record<string, unknown>
    const shiftType = String((raw.type as { name?: unknown } | undefined)?.name ?? '').toLowerCase()
    if (shiftType && !shiftType.includes('gewerkte')) continue

    const shiftStart = shiftStartFromRaw(raw)
    if (!shiftStart) continue
    const businessDate = calendarYmdInAmsterdam(shiftStart)
    if (businessDate < startDate || businessDate > endDate) continue

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
    if (!isEitjeShiftClockedOut(rawEnd, now) || !rawEnd) continue

    out.push({
      locationId,
      businessDate,
      teamName: String(
        (raw.team as { name?: unknown } | undefined)?.name ?? raw.team_name ?? extracted.teamName ?? '',
      ),
      shiftStartMs: shiftStart.getTime(),
      shiftEndMs: rawEnd.getTime(),
    })
  }

  return out
}

function emptySummary(): WeeklyOpeningClosingSummary {
  const team = { preOpenHours: 0, postCloseHours: 0, outsideHours: 0 }
  return {
    preOpenHours: 0,
    postCloseHours: 0,
    outsideHours: 0,
    keuken: { ...team },
    bediening: { ...team },
  }
}

export async function buildWeeklyOpeningClosing(
  db: Db,
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<WeeklyOpeningClosingSummary> {
  const locationIds =
    locationId === 'all'
      ? DAILY_OPS_VENUE_OPENING_HOURS.map((v) => v.locationId)
      : VENUE_STRIP_LOCATIONS.some((v) => v.locationId === locationId)
        ? [locationId]
        : []

  if (locationIds.length === 0) return emptySummary()

  const shifts = await fetchEitjeGewerkteShifts(db, startDate, endDate, locationIds)
  const totals = accumulateOpeningClosingShifts(shifts)

  return {
    preOpenHours: totals.preOpenHours,
    postCloseHours: totals.postCloseHours,
    outsideHours: totals.outsideHours,
    keuken: totals.keuken,
    bediening: totals.bediening,
  }
}
