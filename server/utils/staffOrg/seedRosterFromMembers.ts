/**
 * @registry-id: staffOrgSeedRoster
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-08-13T12:10:00.000Z
 * @description: Load FT/PT/ZZP roster — active OR worked in last 3 months
 * @last-fix: [2026-08-13] Always include Alvinio + Bas Butters as ZZP (even if inactive / missing contract)
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/utils/staffOrg/scenarioRepo.ts
 * ✓ server/api/staff-org/roster.get.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type { StaffOrgRosterMember, StaffOrgTeam } from '~/types/staff-org'
import { classifyStaffContractType } from '~/utils/dailyOpsStaffContractBuckets'
import { weeklyHoursFromContractType } from '~/utils/dailyOpsLeerlingWageFallback'

/** Look-back for “worked at a venue recently”. */
const RECENT_WORK_DAYS = 90

/**
 * Always on every planner roster as ZZP (fill gaps) — even if inactive,
 * missing contract_type, or only present in unified_user.
 */
const FORCE_ZZP_ON_ROSTER: {
  match: RegExp
  displayName: string
  defaultHourly: number
}[] = [
  { match: /alvinio/, displayName: 'Alvinio Molina', defaultHourly: 24 },
  { match: /bas\s*butters|butters\s*ruben/, displayName: 'Bas Butters', defaultHourly: 45 },
]

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function asId(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (raw instanceof ObjectId) return raw.toHexString()
  const s = String(raw).trim()
  return s && s !== 'undefined' && s !== 'null' ? s : null
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function inferTeamHint(raw: unknown): StaffOrgTeam | null {
  const s = String(raw ?? '').toLowerCase()
  if (s.includes('keuken') || s.includes('kitchen') || s.includes('afwas')) return 'keuken'
  if (s.includes('bar') && !s.includes('barbea') && !s.includes('bar bea')) return 'bar'
  if (s === 'bar') return 'bar'
  if (/\bbar\b/.test(s)) return 'bar'
  if (s.includes('bedien') || s.includes('service')) return 'bediening'
  return null
}

async function buildLocationNameToUnifiedId(db: Db): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unified = await db.collection('unified_location').find({}).toArray()
  for (const row of unified) {
    const id = row._id instanceof ObjectId ? row._id.toHexString() : String(row._id)
    for (const n of [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])]) {
      if (!n) continue
      map.set(normName(String(n)), id)
    }
  }
  return map
}

async function buildLegacyLocationIdToUnified(
  db: Db,
  locMap: Map<string, string>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const legacy = await db.collection('locations').find({}).project({ name: 1 }).toArray()
  for (const row of legacy) {
    const lid = row._id instanceof ObjectId ? row._id.toHexString() : String(row._id)
    const unified = locMap.get(normName(String(row.name ?? '')))
    if (unified) out.set(lid, unified)
  }
  return out
}

/** member_id → contract_location (latest saldo). */
async function buildMemberIdToLocName(db: Db): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const rows = await db
    .collection('member_eitje_saldo_snapshot')
    .find(
      { member_id: { $exists: true }, contract_location: { $exists: true, $ne: '' } },
      { projection: { member_id: 1, contract_location: 1, snapshot_date: 1 } },
    )
    .sort({ snapshot_date: -1 })
    .toArray()
  for (const row of rows) {
    const mid = String(row.member_id ?? '').trim()
    if (!mid || out.has(mid)) continue
    out.set(mid, String(row.contract_location))
  }
  return out
}

/** normalized employee name → contract_location (latest inbox contract). */
async function buildNameToLocName(db: Db): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const rows = await db
    .collection('inbox-eitje-contracts')
    .find(
      { employee_name: { $exists: true }, contract_location: { $exists: true, $ne: '' } },
      { projection: { employee_name: 1, contract_location: 1, importedAt: 1 } },
    )
    .sort({ importedAt: -1 })
    .toArray()
  for (const row of rows) {
    const key = normName(String(row.employee_name ?? ''))
    if (!key || out.has(key)) continue
    out.set(key, String(row.contract_location))
  }
  return out
}

/** Names who worked at a venue in the look-back window + contract from hours. */
async function buildRecentWorkerNames(db: Db): Promise<{
  names: Set<string>
  contractByName: Map<string, string>
}> {
  const since = new Date()
  since.setDate(since.getDate() - RECENT_WORK_DAYS)
  const rows = await db
    .collection('inbox-eitje-hours')
    .find(
      {
        employee_name: { $exists: true, $ne: '' },
        date: { $gte: since },
      },
      { projection: { employee_name: 1, contract_type: 1, date: 1 } },
    )
    .sort({ date: -1 })
    .limit(20_000)
    .toArray()

  const names = new Set<string>()
  const contractByName = new Map<string, string>()
  for (const row of rows) {
    const key = normName(String(row.employee_name ?? ''))
    if (!key) continue
    names.add(key)
    const ct = String(row.contract_type ?? '')
    if (ct && !contractByName.has(key) && classifyStaffContractType(ct)) {
      contractByName.set(key, ct)
    }
  }
  return { names, contractByName }
}

/** normalized name → { location, team } from recent hours. */
async function buildNameToHoursContext(db: Db): Promise<Map<string, { location: string; team: string | null }>> {
  const out = new Map<string, { location: string; team: string | null }>()
  const since = new Date()
  since.setDate(since.getDate() - RECENT_WORK_DAYS)
  const rows = await db
    .collection('inbox-eitje-hours')
    .find(
      {
        employee_name: { $exists: true },
        location_name: { $exists: true, $ne: '' },
        date: { $gte: since },
      },
      { projection: { employee_name: 1, location_name: 1, team_name: 1, date: 1 } },
    )
    .sort({ date: -1 })
    .limit(8000)
    .toArray()

  const counts = new Map<string, Map<string, number>>()
  const teamVote = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const key = normName(String(row.employee_name ?? ''))
    const loc = String(row.location_name ?? '')
    if (!key || !loc) continue
    if (!counts.has(key)) counts.set(key, new Map())
    const cm = counts.get(key)!
    cm.set(loc, (cm.get(loc) ?? 0) + 1)
    const team = String(row.team_name ?? '')
    if (team) {
      if (!teamVote.has(key)) teamVote.set(key, new Map())
      const tm = teamVote.get(key)!
      tm.set(team, (tm.get(team) ?? 0) + 1)
    }
  }

  for (const [key, cm] of counts) {
    let bestLoc = ''
    let bestN = 0
    for (const [loc, n] of cm) {
      if (n > bestN) {
        bestLoc = loc
        bestN = n
      }
    }
    let bestTeam: string | null = null
    let bestTN = 0
    for (const [team, n] of teamVote.get(key) ?? []) {
      if (n > bestTN) {
        bestTeam = team
        bestTN = n
      }
    }
    if (bestLoc) out.set(key, { location: bestLoc, team: bestTeam })
  }
  return out
}

export async function seedRosterFromMembers(db: Db): Promise<StaffOrgRosterMember[]> {
  const locMap = await buildLocationNameToUnifiedId(db)
  const [rows, legacyToUnified, memberIdLoc, nameLoc, hoursCtx, recent] = await Promise.all([
    db
      .collection('members')
      .find(
        {},
        {
          projection: {
            name: 1,
            contract_type: 1,
            hourly_rate: 1,
            hourly_wage: 1,
            cost_per_hour: 1,
            location_id: 1,
            team_name: 1,
            team: 1,
            is_active: 1,
          },
        },
      )
      .toArray(),
    buildLegacyLocationIdToUnified(db, locMap),
    buildMemberIdToLocName(db),
    buildNameToLocName(db),
    buildNameToHoursContext(db),
    buildRecentWorkerNames(db),
  ])
  const unifiedIds = new Set(locMap.values())

  const out: StaffOrgRosterMember[] = []

  const resolveHome = (id: string, nameKey: string, locationId: unknown): string | null => {
    let homeLocationId: string | null = null
    const direct = asId(locationId)
    if (direct) {
      homeLocationId = unifiedIds.has(direct)
        ? direct
        : (legacyToUnified.get(direct) ?? null)
    }
    if (!homeLocationId) {
      const locName = memberIdLoc.get(id)
        ?? nameLoc.get(nameKey)
        ?? hoursCtx.get(nameKey)?.location
        ?? null
      if (locName) homeLocationId = locMap.get(normName(locName)) ?? null
    }
    return homeLocationId
  }

  const pushFromRow = (
    row: (typeof rows)[number],
    opts?: { forceZzp?: boolean; displayName?: string; defaultHourly?: number },
  ): void => {
    const nameKey = normName(String(row.name ?? ''))
    let contractType = String(row.contract_type ?? '')
    if (!classifyStaffContractType(contractType)) {
      contractType = recent.contractByName.get(nameKey) ?? ''
    }
    if (opts?.forceZzp) contractType = 'zzp'
    if (!classifyStaffContractType(contractType)) return

    const id = row._id instanceof ObjectId ? row._id.toHexString() : String(row._id)
    if (out.some((m) => m.memberId === id)) return

    const hourlyRate =
      toNum(row.hourly_rate) || toNum(row.hourly_wage) || (opts?.defaultHourly ?? 0)
    const costPerHour = toNum(row.cost_per_hour) || hourlyRate
    const teamHint = inferTeamHint(row.team_name ?? row.team)
      ?? inferTeamHint(hoursCtx.get(nameKey)?.team)

    out.push({
      memberId: id,
      name: opts?.displayName ?? String(row.name ?? 'Unknown'),
      teamHint,
      contractType,
      weeklyContractHours: weeklyHoursFromContractType(contractType),
      hourlyRate,
      costPerHour,
      homeLocationId: resolveHome(id, nameKey, row.location_id),
    })
  }

  for (const row of rows) {
    const nameKey = normName(String(row.name ?? ''))
    const isActive = row.is_active !== false
    const workedRecently = recent.names.has(nameKey)
    // Active members, or inactive who still worked at a venue in the look-back
    if (!isActive && !workedRecently) continue
    pushFromRow(row)
  }

  // Force ZZP planners (Alvinio, Bas Butters, …) even when members data is incomplete
  for (const force of FORCE_ZZP_ON_ROSTER) {
    if (out.some((m) => force.match.test(m.name))) {
      for (const m of out) {
        if (!force.match.test(m.name)) continue
        m.contractType = 'zzp'
        m.weeklyContractHours = weeklyHoursFromContractType('zzp')
        if (!m.hourlyRate) m.hourlyRate = force.defaultHourly
        if (!m.costPerHour) m.costPerHour = m.hourlyRate || force.defaultHourly
      }
      continue
    }

    const candidates = rows
      .filter((r) => force.match.test(String(r.name ?? '')))
      .sort((a, b) => String(b.name ?? '').length - String(a.name ?? '').length)
    if (candidates[0]) {
      pushFromRow(candidates[0], {
        forceZzp: true,
        displayName: force.displayName,
        defaultHourly: force.defaultHourly,
      })
      continue
    }

    const uuRows = await db
      .collection('unified_user')
      .find(
        { canonicalName: force.match },
        { projection: { canonicalName: 1, hourly_rate: 1, contract_type: 1 } },
      )
      .toArray()
    const uu = uuRows.sort(
      (a, b) => toNum(b.hourly_rate) - toNum(a.hourly_rate)
        || String(b.canonicalName ?? '').length - String(a.canonicalName ?? '').length,
    )[0]
    if (!uu) continue
    const id = uu._id instanceof ObjectId ? uu._id.toHexString() : String(uu._id)
    if (out.some((m) => m.memberId === id)) continue
    const rate = toNum(uu.hourly_rate) || force.defaultHourly
    out.push({
      memberId: id,
      name: force.displayName,
      teamHint: null,
      contractType: 'zzp',
      weeklyContractHours: weeklyHoursFromContractType('zzp'),
      hourlyRate: rate,
      costPerHour: rate,
      homeLocationId: null,
    })
  }

  out.sort((a, b) => a.name.localeCompare(b.name, 'nl'))
  return out
}
