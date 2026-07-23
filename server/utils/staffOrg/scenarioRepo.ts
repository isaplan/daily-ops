/**
 * @registry-id: staffOrgScenarioRepo
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-23T01:45:00.000Z
 * @description: Mongo CRUD for staff_org_scenarios
 * @last-fix: [2026-07-23] Scenario venues; close strips org assignments
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/api/staff-org/scenarios/*
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type {
  StaffOrgAssignment,
  StaffOrgExecutiveArea,
  StaffOrgExecutiveAssignment,
  StaffOrgLocationRule,
  StaffOrgLocationTargets,
  StaffOrgPlacement,
  StaffOrgRosterMember,
  StaffOrgScenario,
  StaffOrgScenarioListItem,
  StaffOrgScenarioStatus,
  StaffOrgSlot,
  StaffOrgTeam,
  StaffOrgVenue,
  StaffOrgWeekday,
} from '~/types/staff-org'
import { seedRosterFromMembers } from '~/server/utils/staffOrg/seedRosterFromMembers'
import {
  dedupeOrgAssignments,
  mergeOrgAssignmentsFromRoster,
  rebuildOrgAssignmentsFromRoster,
} from '~/utils/staffOrg/seedOrgAssignments'
import { defaultStaffOrgVenues, normalizeStaffOrgVenues } from '~/utils/staffOrg/defaultVenues'
import { DAILY_OPS_VENUE_OPENING_HOURS } from '~/utils/dailyOpsVenueOpeningHours'

/** Bump when org seed rules change (home-location placement, PT/ZZP). */
const ORG_SEED_VERSION = 7

const COLLECTION = 'staff_org_scenarios'
const ALL_TEAMS: StaffOrgTeam[] = ['bediening', 'keuken', 'bar']
const ALL_ROLES = ['manager', 'floor_manager', 'ft', 'pt', 'zzp'] as const
const EXEC_AREAS: StaffOrgExecutiveArea[] = ['general', 'keuken', 'operations']

function normalizeExecutive(raw: unknown): StaffOrgExecutiveAssignment[] {
  if (!Array.isArray(raw)) return []
  const byMember = new Map<string, StaffOrgExecutiveAssignment>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const memberId = String(r.memberId ?? '').trim()
    const area = String(r.area ?? '') as StaffOrgExecutiveArea
    if (!memberId || !EXEC_AREAS.includes(area)) continue
    byMember.set(memberId, { memberId, area })
  }
  return [...byMember.values()]
}

function defaultRules(): StaffOrgLocationRule[] {
  const rules: StaffOrgLocationRule[] = []
  const slots: StaffOrgSlot[] = ['day', 'evening']
  const weekdays = [0, 1, 2, 3, 4, 5, 6] as StaffOrgWeekday[]
  for (const v of DAILY_OPS_VENUE_OPENING_HOURS) {
    for (const team of ALL_TEAMS) {
      for (const weekday of weekdays) {
        for (const slot of slots) {
          rules.push({
            locationId: v.locationId,
            team,
            weekday,
            slot,
            minStaff: 0,
            maxStaff: 8,
          })
        }
      }
    }
  }
  return rules
}

function defaultLocationTargets(): StaffOrgLocationTargets[] {
  return DAILY_OPS_VENUE_OPENING_HOURS.map((v) => ({
    locationId: v.locationId,
    estimatedMonthlyRevenue: v.locationName.includes('Kinsbergen') ? 150_000 : 0,
    minLaborProductivity: 0,
  }))
}

function openVenueIds(venues: StaffOrgVenue[]): string[] {
  return venues.filter((v) => v.status === 'open').map((v) => v.locationId)
}

function normalizeAssignments(raw: unknown): StaffOrgAssignment[] {
  if (!Array.isArray(raw)) return []
  const normalized = raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const a = row as Record<string, unknown>
      const memberId = String(a.memberId ?? '')
      const locationId = String(a.locationId ?? '')
      const teamRaw = String(a.team ?? '')
      const team = (ALL_TEAMS.includes(teamRaw as StaffOrgTeam)
        ? teamRaw
        : null) as StaffOrgTeam | null
      let role = String(a.role ?? '')
      if (role === 'pt_zzp') role = 'pt'
      if (!memberId || !locationId || !team) return null
      if (!(ALL_ROLES as readonly string[]).includes(role)) return null
      return {
        memberId,
        locationId,
        team,
        role: role as StaffOrgAssignment['role'],
      }
    })
    .filter((a): a is StaffOrgAssignment => Boolean(a))
  return dedupeOrgAssignments(normalized)
}

function placementsForOrg(
  placements: StaffOrgPlacement[],
  orgAssignments: StaffOrgAssignment[],
  inactiveMemberIds: string[],
): StaffOrgPlacement[] {
  const inactive = new Set(inactiveMemberIds)
  const allowed = new Set(
    orgAssignments.map((a) => `${a.memberId}|${a.locationId}|${a.team}`),
  )
  return placements.filter((p) => {
    if (inactive.has(p.memberId)) return false
    return allowed.has(`${p.memberId}|${p.locationId}|${p.team}`)
  })
}

function serialize(doc: Record<string, unknown>): StaffOrgScenario {
  const id = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id)
  const roster = Array.isArray(doc.roster) ? (doc.roster as StaffOrgRosterMember[]) : []
  const inactiveMemberIds = Array.isArray(doc.inactiveMemberIds)
    ? (doc.inactiveMemberIds as string[]).map(String)
    : Array.isArray(doc.excludedMemberIds)
      ? (doc.excludedMemberIds as string[]).map(String)
      : []
  const venues = normalizeStaffOrgVenues(doc.venues)
  const closedIds = new Set(venues.filter((v) => v.status === 'closed').map((v) => v.locationId))
  let orgAssignments = normalizeAssignments(doc.orgAssignments)
  if (
    orgAssignments.length === 0
    && roster.length > 0
    && (!Array.isArray(doc.orgAssignments) || (doc.orgAssignments as unknown[]).length === 0)
  ) {
    orgAssignments = rebuildOrgAssignmentsFromRoster({
      roster,
      inactiveMemberIds,
      openVenueIds: openVenueIds(venues),
    })
  }
  orgAssignments = orgAssignments.filter((a) => !closedIds.has(a.locationId))
  const executiveAssignments = normalizeExecutive(doc.executiveAssignments)
    .filter((e) => !inactiveMemberIds.includes(e.memberId))
  // Executive staff leave venue org
  const execIds = new Set(executiveAssignments.map((e) => e.memberId))
  orgAssignments = orgAssignments.filter((a) => !execIds.has(a.memberId))
  return {
    _id: id,
    name: String(doc.name ?? ''),
    status: (doc.status as StaffOrgScenarioStatus) ?? 'draft',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ''),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ''),
    venues,
    locationRules: Array.isArray(doc.locationRules) ? (doc.locationRules as StaffOrgLocationRule[]) : [],
    locationTargets: Array.isArray(doc.locationTargets)
      ? (doc.locationTargets as StaffOrgLocationTargets[])
      : defaultLocationTargets(),
    placements: Array.isArray(doc.placements)
      ? (doc.placements as StaffOrgPlacement[]).filter((p) => !closedIds.has(p.locationId))
      : [],
    roster,
    orgAssignments,
    executiveAssignments,
    inactiveMemberIds,
  }
}

export async function listStaffOrgScenarios(db: Db): Promise<StaffOrgScenarioListItem[]> {
  const rows = await db
    .collection(COLLECTION)
    .find({})
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray()

  return rows.map((doc) => {
    const s = serialize(doc)
    return {
      _id: s._id,
      name: s.name,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      placementCount: s.placements.length,
      rosterCount: s.roster.length,
    }
  })
}

export async function createStaffOrgScenario(
  db: Db,
  name: string,
): Promise<StaffOrgScenario> {
  const now = new Date()
  const roster = await seedRosterFromMembers(db)
  const venues = defaultStaffOrgVenues()
  const orgAssignments = rebuildOrgAssignmentsFromRoster({
    roster,
    inactiveMemberIds: [],
    openVenueIds: openVenueIds(venues),
  })
  const doc = {
    name: name.trim(),
    status: 'draft' as const,
    createdAt: now,
    updatedAt: now,
    venues,
    locationRules: defaultRules(),
    locationTargets: defaultLocationTargets(),
    placements: [] as StaffOrgPlacement[],
    roster,
    orgAssignments,
    executiveAssignments: [] as StaffOrgExecutiveAssignment[],
    inactiveMemberIds: [] as string[],
    orgSeedVersion: ORG_SEED_VERSION,
  }
  const result = await db.collection(COLLECTION).insertOne(doc)
  return serialize({ ...doc, _id: result.insertedId })
}

export async function getStaffOrgScenario(
  db: Db,
  id: string,
): Promise<StaffOrgScenario | null> {
  if (!ObjectId.isValid(id)) return null
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
  if (!doc) return null

  const seedVersion = typeof doc.orgSeedVersion === 'number' ? doc.orgSeedVersion : 0
  // One-time roster upgrade — merge new people; keep planner org/executive moves
  if (seedVersion < ORG_SEED_VERSION) {
    const venues = normalizeStaffOrgVenues(doc.venues)
    const inactiveMemberIds = Array.isArray(doc.inactiveMemberIds)
      ? (doc.inactiveMemberIds as string[]).map(String)
      : []
    const executiveAssignments = normalizeExecutive(doc.executiveAssignments)
      .filter((e) => !inactiveMemberIds.includes(e.memberId))
    const execIds = new Set(executiveAssignments.map((e) => e.memberId))
    const roster = await seedRosterFromMembers(db)
    const existingOrg = normalizeAssignments(doc.orgAssignments)
    const closedIds = new Set(venues.filter((v) => v.status === 'closed').map((v) => v.locationId))
    const orgAssignments = (
      existingOrg.length > 0
        ? mergeOrgAssignmentsFromRoster({
            roster,
            existing: existingOrg,
            inactiveMemberIds,
            openVenueIds: openVenueIds(venues),
          })
        : rebuildOrgAssignmentsFromRoster({
            roster,
            inactiveMemberIds,
            openVenueIds: openVenueIds(venues),
          })
    ).filter((a) => !execIds.has(a.memberId) && !closedIds.has(a.locationId))
    const placements = placementsForOrg(
      Array.isArray(doc.placements) ? (doc.placements as StaffOrgPlacement[]) : [],
      orgAssignments,
      inactiveMemberIds,
    )
    await db.collection(COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          venues,
          roster,
          orgAssignments,
          executiveAssignments,
          placements,
          orgSeedVersion: ORG_SEED_VERSION,
          updatedAt: new Date(),
        },
      },
    )
    const fresh = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
    return fresh ? serialize(fresh as Record<string, unknown>) : null
  }

  const serialized = serialize(doc)
  const $persist: Record<string, unknown> = {}
  if (!Array.isArray(doc.venues) || (doc.venues as unknown[]).length === 0) {
    $persist.venues = serialized.venues
  }
  if (!Array.isArray(doc.orgAssignments) || (doc.orgAssignments as unknown[]).length === 0) {
    if (serialized.orgAssignments.length > 0) $persist.orgAssignments = serialized.orgAssignments
  }
  if (Object.keys($persist).length > 0) {
    $persist.updatedAt = new Date()
    await db.collection(COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: $persist })
  }
  return serialized
}

export type StaffOrgScenarioPatch = {
  name?: string
  status?: StaffOrgScenarioStatus
  venues?: StaffOrgVenue[]
  locationRules?: StaffOrgLocationRule[]
  locationTargets?: StaffOrgLocationTargets[]
  placements?: StaffOrgPlacement[]
  orgAssignments?: StaffOrgAssignment[]
  executiveAssignments?: StaffOrgExecutiveAssignment[]
  inactiveMemberIds?: string[]
  refreshRoster?: boolean
}

export async function patchStaffOrgScenario(
  db: Db,
  id: string,
  patch: StaffOrgScenarioPatch,
): Promise<StaffOrgScenario | null> {
  if (!ObjectId.isValid(id)) return null
  const existing = await db.collection(COLLECTION).findOne(
    { _id: new ObjectId(id) },
    {
      projection: {
        placements: 1,
        inactiveMemberIds: 1,
        orgAssignments: 1,
        executiveAssignments: 1,
        roster: 1,
        venues: 1,
      },
    },
  )
  if (!existing) return null

  const $set: Record<string, unknown> = { updatedAt: new Date() }
  if (typeof patch.name === 'string' && patch.name.trim()) $set.name = patch.name.trim()
  if (patch.status) $set.status = patch.status
  if (Array.isArray(patch.locationRules)) $set.locationRules = patch.locationRules
  if (Array.isArray(patch.locationTargets)) $set.locationTargets = patch.locationTargets

  let venues = Array.isArray(patch.venues)
    ? normalizeStaffOrgVenues(patch.venues)
    : normalizeStaffOrgVenues(existing.venues)
  if (Array.isArray(patch.venues)) $set.venues = venues

  const closedIds = new Set(venues.filter((v) => v.status === 'closed').map((v) => v.locationId))

  let inactive = Array.isArray(patch.inactiveMemberIds)
    ? [...new Set(patch.inactiveMemberIds.map(String))]
    : Array.isArray(existing.inactiveMemberIds)
      ? (existing.inactiveMemberIds as string[]).map(String)
      : []

  let orgAssignments = Array.isArray(patch.orgAssignments)
    ? normalizeAssignments(patch.orgAssignments)
    : normalizeAssignments(existing.orgAssignments)

  let executiveAssignments = Array.isArray(patch.executiveAssignments)
    ? normalizeExecutive(patch.executiveAssignments)
    : normalizeExecutive(existing.executiveAssignments)

  if (Array.isArray(patch.inactiveMemberIds)) {
    $set.inactiveMemberIds = inactive
  }

  const inactiveSet = new Set(inactive)

  if (
    Array.isArray(patch.orgAssignments)
    || Array.isArray(patch.venues)
    || Array.isArray(patch.inactiveMemberIds)
    || Array.isArray(patch.executiveAssignments)
  ) {
    orgAssignments = orgAssignments
      .filter((a) => !inactiveSet.has(a.memberId) && !closedIds.has(a.locationId))
    orgAssignments = dedupeOrgAssignments(orgAssignments)
    executiveAssignments = executiveAssignments.filter((e) => !inactiveSet.has(e.memberId))

    // Mutual exclusion: venue ↔ executive
    const execIds = new Set(executiveAssignments.map((e) => e.memberId))
    if (Array.isArray(patch.executiveAssignments)) {
      orgAssignments = orgAssignments.filter((a) => !execIds.has(a.memberId))
    }
    if (Array.isArray(patch.orgAssignments)) {
      const orgIds = new Set(orgAssignments.map((a) => a.memberId))
      executiveAssignments = executiveAssignments.filter((e) => !orgIds.has(e.memberId))
    }

    $set.orgAssignments = orgAssignments
    $set.executiveAssignments = executiveAssignments
  }

  if (patch.refreshRoster) {
    const roster = await seedRosterFromMembers(db)
    $set.roster = roster
    const execIds = new Set(executiveAssignments.map((e) => e.memberId))
    orgAssignments = rebuildOrgAssignmentsFromRoster({
      roster,
      inactiveMemberIds: inactive,
      openVenueIds: openVenueIds(venues),
    }).filter((a) => !execIds.has(a.memberId))
    $set.orgAssignments = orgAssignments
    $set.orgSeedVersion = ORG_SEED_VERSION
  }

  let placements = Array.isArray(patch.placements)
    ? patch.placements
    : Array.isArray(existing.placements)
      ? (existing.placements as StaffOrgPlacement[])
      : []

  if (
    Array.isArray(patch.placements)
    || Array.isArray(patch.orgAssignments)
    || Array.isArray(patch.inactiveMemberIds)
    || Array.isArray(patch.venues)
    || Array.isArray(patch.executiveAssignments)
    || patch.refreshRoster
  ) {
    placements = placementsForOrg(placements, orgAssignments, inactive)
      .filter((p) => !closedIds.has(p.locationId))
    $set.placements = placements
  }

  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set },
    { returnDocument: 'after' },
  )
  if (!result) return null
  return serialize(result as Record<string, unknown>)
}

export async function deleteStaffOrgScenario(db: Db, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const result = await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount === 1
}
