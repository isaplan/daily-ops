/**
 * @registry-id: opsNotificationIntegrationSyncDataCoverage
 * @created: 2026-07-26T17:45:00.000Z
 * @last-modified: 2026-07-26T17:45:00.000Z
 * @description: Resolve Bork cred locationIds → DO venues; detect when sync-window data already exists
 * @last-fix: [2026-07-26] Clear stale historical-7d alerts when daily/inbox already covered the window
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/opsNotifications/detectors/integrationSyncFailures.ts
 * ✓ server/utils/opsNotifications/tryFixNotification.ts
 */

import { ObjectId, type Db } from 'mongodb'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'

function normName (s: string): string {
  return s.trim().toLowerCase().replace(/['']/g, "'")
}

function daysInRange (startDate: string, endDate: string): string[] {
  const out: string[] = []
  for (let d = startDate; d <= endDate; d = addCalendarDaysYmd(d, 1)) {
    out.push(d)
  }
  return out
}

/** Map Bork api_credentials.locationId → Daily Ops venue locationId (unified / strip). */
export async function resolveDoLocationIdForBorkCredLocation (
  db: Db,
  borkLocationId: string,
): Promise<string | null> {
  const orLoc: Record<string, unknown>[] = [{ locationId: borkLocationId }]
  try {
    orLoc.push({ locationId: new ObjectId(borkLocationId) })
  } catch {
    // ignore
  }
  const cred = await db.collection('api_credentials').findOne({
    provider: { $in: ['bork', 'Bork'] },
    $or: orLoc,
  })
  const name = String(cred?.locationName ?? '').trim()
  if (!name) return null

  const strip = VENUE_STRIP_LOCATIONS.find((v) => normName(v.locationName) === normName(name))
  if (strip) return strip.locationId

  const unified = await db.collection('unified_location').findOne({
    $or: [
      { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      { aliases: name },
    ],
  })
  const id = String(unified?.primaryId ?? unified?._id ?? '')
  return id || null
}

async function dayHasRevenueCoverage (db: Db, doLocationId: string, businessDate: string): Promise<boolean> {
  const snap = await db.collection('daily_ops_snapshot_section_revenue').findOne(
    { businessDate, locationId: doLocationId },
    { projection: { 'totals.ex_vat': 1 } },
  )
  if (Number(snap?.totals?.ex_vat ?? 0) > 0) return true

  const locFilter: Record<string, unknown>[] = [{ locationId: doLocationId }]
  try {
    locFilter.push({ locationId: new ObjectId(doLocationId) })
  } catch {
    // ignore
  }
  const bd = await db.collection('bork_business_days_v2').findOne(
    { business_date: businessDate, $or: locFilter },
    { projection: { total_revenue_ex_vat: 1 } },
  )
  if (Number(bd?.total_revenue_ex_vat ?? 0) > 0) return true

  const hours = await db.collection('bork_sales_by_hour_v2').countDocuments({
    business_date: businessDate,
    $or: locFilter,
  })
  return hours > 0
}

/**
 * True when every failed Bork location already has revenue coverage for every day in the sync window
 * (daily-data / inbox / prior syncs filled the gap — historical-7d miss is not a data outage).
 */
export async function failedLocationsWindowCovered (
  db: Db,
  failedLocations: Array<{ locationId?: string }>,
  startDate: string,
  endDate: string,
): Promise<{ covered: boolean; detail: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { covered: false, detail: 'invalid sync window' }
  }
  if (failedLocations.length === 0) {
    return { covered: true, detail: 'no failed locations' }
  }

  const days = daysInRange(startDate, endDate)
  const parts: string[] = []

  for (const loc of failedLocations) {
    const borkLocId = loc.locationId != null ? String(loc.locationId) : ''
    if (!borkLocId) {
      return { covered: false, detail: 'failed location missing locationId' }
    }
    const doId = await resolveDoLocationIdForBorkCredLocation(db, borkLocId)
    if (!doId) {
      return { covered: false, detail: `no DO venue map for Bork location ${borkLocId}` }
    }
    const missing: string[] = []
    for (const day of days) {
      if (!(await dayHasRevenueCoverage(db, doId, day))) missing.push(day)
    }
    if (missing.length > 0) {
      return {
        covered: false,
        detail: `${doId} missing coverage on ${missing.join(', ')}`,
      }
    }
    parts.push(`${doId}: ok ${days.length}d`)
  }

  return { covered: true, detail: parts.join(' · ') }
}

export type CronLocationRow = {
  locationId?: string
  ok?: boolean
  error?: string
  ticketsByDate?: Record<string, number>
  healedAt?: string
  healNote?: string
}

/** After successful single-location retry (or data-coverage heal), mark location ok on cron row. */
export async function patchIntegrationCronLocationsHealed (
  db: Db,
  source: 'bork' | 'eitje',
  jobType: string,
  healedLocationIds: string[],
  healNote: string,
): Promise<{ allOk: boolean }> {
  if (healedLocationIds.length === 0) return { allOk: false }

  const query = { source, jobType }
  const row = await db.collection('integration_cron_jobs').findOne(query)
  if (!row) return { allOk: false }

  const healed = new Set(healedLocationIds.map(String))
  const detail = (row.lastSyncDetail ?? {}) as {
    ok?: boolean
    fullSync?: boolean
    locations?: CronLocationRow[]
    jobType?: string
    message?: string
  }
  const nowIso = new Date().toISOString()
  const locations = (detail.locations ?? []).map((loc) => {
    const id = loc.locationId != null ? String(loc.locationId) : ''
    if (!id || !healed.has(id)) return loc
    return {
      ...loc,
      ok: true,
      error: undefined,
      healedAt: nowIso,
      healNote,
    }
  })
  const allOk = locations.length > 0 && locations.every((l) => l.ok !== false)
  const nextDetail = {
    ...detail,
    ok: allOk,
    fullSync: allOk,
    locations,
  }

  await db.collection('integration_cron_jobs').updateOne(query, {
    $set: {
      lastSyncOk: allOk,
      lastSyncDetail: nextDetail,
      lastSyncMessage: allOk
        ? `Healed ${healedLocationIds.length} location(s): ${healNote}`
        : String(row.lastSyncMessage ?? ''),
      updatedAt: new Date(),
      ...(allOk ? { lastSyncAt: nowIso } : {}),
    },
  })

  return { allOk }
}
