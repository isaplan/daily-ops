/**
 * @registry-id: staffOrgSeedFromMonth
 * @created: 2026-07-22T22:00:00.000Z
 * @last-modified: 2026-07-22T22:00:00.000Z
 * @description: Seed Staff Org scenario from monthly labor snapshots — multi-day FT placements
 * @last-fix: [2026-07-22] June baseline seed with weekday averages + day/evening slot
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/api/staff-org/scenarios/seed-from-month.post.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type {
  StaffOrgPlacement,
  StaffOrgRosterMember,
  StaffOrgScenario,
  StaffOrgSlot,
  StaffOrgTeam,
  StaffOrgWeekday,
} from '~/types/staff-org'
import { classifyStaffContractType } from '~/utils/dailyOpsStaffContractBuckets'
import { amsterdamWeekdayMon0 } from '~/utils/dailyOpsVenueOpeningHours'
import { DAILY_OPS_VENUE_OPENING_HOURS } from '~/utils/dailyOpsVenueOpeningHours'
import { seedRosterFromMembers } from '~/server/utils/staffOrg/seedRosterFromMembers'
import { createStaffOrgScenario, patchStaffOrgScenario } from '~/server/utils/staffOrg/scenarioRepo'
import { buildOpeningSlotHours } from '~/utils/staffOrg/buildOpeningSlots'
import { rebalanceContractHours } from '~/utils/staffOrg/contractHours'

type AggKey = string

type DayBucket = {
  hoursSum: number
  dayCount: number
  startHourSum: number
  startCount: number
  teamVotes: Record<string, number>
  locationId: string
  eitjeUserId: string
  userName: string
  weekday: StaffOrgWeekday
}

function teamFromName(teamName: string): StaffOrgTeam | null {
  const s = teamName.toLowerCase()
  if (s.includes('keuken') || s.includes('kitchen') || s.includes('afwas')) return 'keuken'
  if (/\bbar\b/.test(s) && !s.includes('barbea')) return 'bar'
  if (s.includes('bedien') || s.includes('service')) return 'bediening'
  return null
}

function pickSlot(
  locationId: string,
  team: StaffOrgTeam,
  weekday: StaffOrgWeekday,
  avgStartHour: number | null,
  slotHoursLookup: Map<string, number | null>,
): StaffOrgSlot | null {
  const dayOpen = slotHoursLookup.get(`${locationId}|${team}|${weekday}|day`)
  const eveOpen = slotHoursLookup.get(`${locationId}|${team}|${weekday}|evening`)
  const dayOk = dayOpen != null && dayOpen > 0
  const eveOk = eveOpen != null && eveOpen > 0
  if (!dayOk && !eveOk) return null
  if (dayOk && !eveOk) return 'day'
  if (!dayOk && eveOk) return 'evening'
  // Both open: start before 16:00 → day (openers); else evening
  if (avgStartHour != null && avgStartHour < 16) return 'day'
  return 'evening'
}

async function loadEitjeToMemberMap(db: Db): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const members = await db.collection('members').find(
    {},
    { projection: { eitje_id: 1, eitje_ids: 1 } },
  ).toArray()
  for (const m of members) {
    const memberId = m._id instanceof ObjectId ? m._id.toHexString() : String(m._id)
    const ids: string[] = []
    if (m.eitje_id != null) ids.push(String(m.eitje_id))
    if (Array.isArray(m.eitje_ids)) {
      for (const x of m.eitje_ids) ids.push(String(x))
    }
    for (const eid of ids) {
      if (eid) map.set(eid, memberId)
    }
  }
  return map
}

/** Average start hour (Amsterdam) per eitje user × location × weekday from raw gewerkte shifts. */
async function loadAvgStartHours(
  db: Db,
  startDate: string,
  endDate: string,
  locationIds: string[],
): Promise<Map<string, { sum: number; n: number }>> {
  const out = new Map<string, { sum: number; n: number }>()
  const locs = await db.collection('locations').find(
    { _id: { $in: locationIds.map((id) => {
      try { return new ObjectId(id) } catch { return id }
    }) } },
    { projection: { eitjeIds: 1, eitje_ids: 1 } },
  ).toArray().catch(() => [])

  // Prefer labor snapshots for hours; start hours from raw when available
  const cursor = db.collection('eitje_raw_data').find({
    endpoint: 'time_registration_shifts',
    'rawApiResponse.date': { $gte: startDate, $lte: endDate },
    'rawApiResponse.type.name': { $regex: /gewerkt/i },
  }, {
    projection: {
      'rawApiResponse.date': 1,
      'rawApiResponse.start': 1,
      'rawApiResponse.user.id': 1,
      'rawApiResponse.environment.id': 1,
    },
  }).limit(20000)

  // Map eitje environment → locationId via DAILY_OPS venues' known mapping is hard;
  // skip raw start if we can't map — fall back to evening default.
  void locs
  for await (const doc of cursor) {
    const raw = doc.rawApiResponse as Record<string, unknown> | undefined
    if (!raw) continue
    const date = String(raw.date ?? '')
    if (!date) continue
    const user = raw.user as { id?: number | string } | undefined
    const uid = user?.id != null ? String(user.id) : ''
    if (!uid) continue
    const start = raw.start ? new Date(String(raw.start)) : null
    if (!start || Number.isNaN(start.getTime())) continue
    const hourStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
      hour: '2-digit',
      hour12: false,
    }).format(start)
    const hour = Number(hourStr)
    if (!Number.isFinite(hour)) continue
    const weekday = amsterdamWeekdayMon0(date)
    // Key without location (env mapping weak) — used as fallback by user×weekday
    const key = `${uid}|${weekday}`
    const cur = out.get(key) ?? { sum: 0, n: 0 }
    cur.sum += hour
    cur.n += 1
    out.set(key, cur)
  }
  return out
}

export async function buildPlacementsFromMonth(
  db: Db,
  args: { startDate: string; endDate: string },
): Promise<{ placements: StaffOrgPlacement[]; roster: StaffOrgRosterMember[] }> {
  const locationIds = DAILY_OPS_VENUE_OPENING_HOURS.map((v) => v.locationId)
  const slotRows = buildOpeningSlotHours()
  const slotLookup = new Map(
    slotRows.map((r) => [`${r.locationId}|${r.team}|${r.weekday}|${r.slot}`, r.openHours] as const),
  )

  const eitjeToMember = await loadEitjeToMemberMap(db)
  const startHours = await loadAvgStartHours(db, args.startDate, args.endDate, locationIds)

  const laborDocs = await db.collection('daily_ops_snapshot_section_labor').find({
    businessDate: { $gte: args.startDate, $lte: args.endDate },
    locationId: { $in: locationIds },
  }).toArray()

  const buckets = new Map<AggKey, DayBucket>()

  for (const doc of laborDocs) {
    const businessDate = String(doc.businessDate ?? '')
    const locationId = String(doc.locationId ?? '')
    if (!businessDate || !locationId) continue
    const weekday = amsterdamWeekdayMon0(businessDate)
    const workers = Array.isArray(doc.workers) ? doc.workers : []
    for (const w of workers) {
      const contractType = String(w.contractType ?? '')
      if (classifyStaffContractType(contractType) !== 'ft') continue
      const team = teamFromName(String(w.teamName ?? ''))
      if (!team) continue
      const eitjeUserId = String(w.userId ?? '')
      if (!eitjeUserId) continue
      const hours = Number(w.hours) || 0
      if (hours <= 0) continue
      const key = `${eitjeUserId}|${locationId}|${team}|${weekday}`
      const cur = buckets.get(key) ?? {
        hoursSum: 0,
        dayCount: 0,
        startHourSum: 0,
        startCount: 0,
        teamVotes: {},
        locationId,
        eitjeUserId,
        userName: String(w.userName ?? ''),
        weekday,
      }
      cur.hoursSum += hours
      cur.dayCount += 1
      cur.teamVotes[team] = (cur.teamVotes[team] ?? 0) + 1
      const sh = startHours.get(`${eitjeUserId}|${weekday}`)
      if (sh && sh.n > 0) {
        cur.startHourSum += sh.sum / sh.n
        cur.startCount += 1
      }
      buckets.set(key, cur)
    }
  }

  const roster = await seedRosterFromMembers(db)
  const rosterById = new Map(roster.map((m) => [m.memberId, m]))
  const placements: StaffOrgPlacement[] = []
  const MIN_OCCURRENCES = 2

  for (const b of buckets.values()) {
    if (b.dayCount < MIN_OCCURRENCES) continue
    const memberId = eitjeToMember.get(b.eitjeUserId)
    if (!memberId || !rosterById.has(memberId)) continue

    let team: StaffOrgTeam = 'bediening'
    let best = 0
    for (const [t, n] of Object.entries(b.teamVotes)) {
      if (n > best) {
        best = n
        team = t as StaffOrgTeam
      }
    }

    const avgHours = Math.round((b.hoursSum / b.dayCount) * 10) / 10
    const avgStart = b.startCount > 0 ? b.startHourSum / b.startCount : null
    const slot = pickSlot(b.locationId, team, b.weekday, avgStart, slotLookup)
    if (!slot) continue

    placements.push({
      memberId,
      locationId: b.locationId,
      team,
      weekday: b.weekday,
      slot,
      hours: avgHours,
    })
  }

  const byMemberWeekday = new Map<string, StaffOrgPlacement[]>()
  for (const p of placements) {
    const k = `${p.memberId}|${p.weekday}`
    const arr = byMemberWeekday.get(k) ?? []
    arr.push(p)
    byMemberWeekday.set(k, arr)
  }
  const deduped: StaffOrgPlacement[] = []
  for (const arr of byMemberWeekday.values()) {
    if (arr.length === 1) {
      deduped.push(arr[0]!)
      continue
    }
    arr.sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0))
    deduped.push(arr[0]!)
  }

  // Days from history; hours from weekly contract ÷ days
  const balanced = rebalanceContractHours(deduped, roster)
  return { placements: balanced, roster }
}

export async function seedScenarioFromMonth(
  db: Db,
  args: { name: string; startDate: string; endDate: string },
): Promise<StaffOrgScenario> {
  const { placements, roster } = await buildPlacementsFromMonth(db, args)
  const scenario = await createStaffOrgScenario(db, args.name)
  const updated = await patchStaffOrgScenario(db, scenario._id, {
    placements,
    status: 'draft',
  })
  return updated ?? { ...scenario, placements, roster }
}

/** Fill an existing scenario (e.g. September) from a history month. */
export async function fillScenarioFromMonth(
  db: Db,
  scenarioId: string,
  args: { startDate: string; endDate: string },
): Promise<StaffOrgScenario | null> {
  const { placements } = await buildPlacementsFromMonth(db, args)
  return patchStaffOrgScenario(db, scenarioId, {
    placements,
    refreshRoster: true,
    status: 'draft',
  })
}

export type { StaffOrgRosterMember }
