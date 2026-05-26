/**
 * @registry-id: dailyOpsSnapshotBuildLaborSection
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-26T00:06:00.000Z
 * @description: Builds DailyOpsSnapshotLaborSection for one (businessDate, locationId)
 *   from eitje_time_registration_aggregation — full Eitje rollups including operational/gewerkt.
 * @last-fix: [2026-05-26] Operational/gewerkte rollup falls back to operational total_hours when gewerkt_* is all-zero/incomplete.
 *
 * @architecture:
 *   - Writers: dailyOpsSnapshotService (cron + rebuild after Eitje agg).
 *   - Readers: venue strip, bundle, metrics — must not re-query eitje_* on GET when section exists.
 *
 * @exports-to:
 *   ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import {
  aggRowsUseLegacyGewerktSchema,
  resolveRowGewerktSlice,
  rollupOperationalLaborForSnapshot,
  type VenueLaborSlice,
} from '../eitjeVenueLaborRollup'
import {
  enrichEitjeAggRowsFromMembers,
  loadMemberCompensationByShiftUserIds,
} from '../eitjeAggCompensationEnrich'
import { fetchLaborByBusinessDateHour } from '../eitjeLaborByHour'
import type {
  DailyOpsSnapshotLaborSection,
  LaborCostPair,
} from '../../../types/daily-ops-snapshot'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
const DEBUG = String(env?.DEBUG ?? '').includes('snapshot:build')

export type BuildLaborInput = {
  businessDate: string
  locationId: string
  locationName: string
}

function emptyPair(): LaborCostPair {
  return { hours: 0, wage_cost: 0, loaded_cost: 0, record_count: 0 }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const LABOR_BUILD_VERSION_WITH_HOURLY = 3

function eitjeAggFilter(businessDate: string, locationId: string): Record<string, unknown> {
  try {
    const oid = new ObjectId(locationId)
    return { period_type: 'day', period: businessDate, locationId: { $in: [oid, locationId] } }
  } catch {
    return { period_type: 'day', period: businessDate, locationId }
  }
}

function addGewerktToTeam(
  team: LaborCostPair & { teamId: string; teamName: string; gewerkt?: LaborCostPair },
  slice: VenueLaborSlice,
): void {
  if (!team.gewerkt) team.gewerkt = emptyPair()
  team.gewerkt.hours += slice.hours
  team.gewerkt.wage_cost += slice.wages
  team.gewerkt.loaded_cost += slice.loaded
  team.gewerkt.record_count += 1
}

export async function buildLaborSection(
  db: Db,
  input: BuildLaborInput,
): Promise<DailyOpsSnapshotLaborSection> {
  const { businessDate, locationId, locationName } = input

  const rows = await db
    .collection('eitje_time_registration_aggregation')
    .find(eitjeAggFilter(businessDate, locationId))
    .toArray()

  await enrichEitjeAggRowsFromMembers(db, rows as Record<string, unknown>[])
  const memberComp = await loadMemberCompensationByShiftUserIds(
    db,
    rows.map((r) => String(r.userId ?? '')),
  )

  const legacyGewerkt = aggRowsUseLegacyGewerktSchema(rows as Record<string, unknown>[])
  const totals = emptyPair()
  const teamsMap = new Map<
    string,
    LaborCostPair & { teamId: string; teamName: string; gewerkt?: LaborCostPair }
  >()
  const contractsMap = new Map<string, LaborCostPair & { contractType: string }>()
  const workers: DailyOpsSnapshotLaborSection['workers'] = []

  for (const r of rows) {
    const hours = Number(r.total_hours ?? 0)
    const hourlyRate = typeof r.hourly_rate === 'number' ? r.hourly_rate : null
    const wageCost = Number(r.total_cost ?? 0)
    const loadedCost = Number(r.total_cost_loaded ?? 0)
    const cph = typeof r.cost_per_hour === 'number' ? r.cost_per_hour : null
    const loadedSource = typeof r.loaded_cost_source === 'string' ? r.loaded_cost_source : 'none'
    const fallback =
      loadedSource === 'fallback-1.56' ||
      loadedSource === 'fallback-1.36' ||
      loadedSource === 'none'
    const userId = String(r.userId ?? '')
    const teamId = String(r.teamId ?? '')
    const teamName = String(r.team_name ?? '')
    const userName = String(r.user_name ?? '')
    const contractType =
      memberComp.get(userId)?.contractType ||
      (String((r as { contract_type?: string }).contract_type ?? '').trim() || '—')

    totals.hours += hours
    totals.wage_cost += wageCost
    totals.loaded_cost += loadedCost
    totals.record_count += 1

    if (!teamsMap.has(teamId)) teamsMap.set(teamId, { ...emptyPair(), teamId, teamName })
    const t = teamsMap.get(teamId)!
    t.hours += hours
    t.wage_cost += wageCost
    t.loaded_cost += loadedCost
    t.record_count += 1

    const gewSlice = resolveRowGewerktSlice(r as Record<string, unknown>, legacyGewerkt)
    if (gewSlice) addGewerktToTeam(t, gewSlice)

    if (!contractsMap.has(contractType)) {
      contractsMap.set(contractType, { ...emptyPair(), contractType })
    }
    const c = contractsMap.get(contractType)!
    c.hours += hours
    c.wage_cost += wageCost
    c.loaded_cost += loadedCost
    c.record_count += 1

    workers.push({
      hours,
      wage_cost: wageCost,
      loaded_cost: loadedCost,
      record_count: 1,
      userId,
      userName,
      teamId,
      teamName,
      contractType,
      hourly_rate: hourlyRate,
      cost_per_hour: cph,
      loaded_cost_fallback: fallback,
    })
  }

  for (const t of teamsMap.values()) {
    if (t.gewerkt) {
      t.gewerkt.hours = round2(t.gewerkt.hours)
      t.gewerkt.wage_cost = round2(t.gewerkt.wage_cost)
      t.gewerkt.loaded_cost = round2(t.gewerkt.loaded_cost)
    }
  }

  const operationalRollup = rollupOperationalLaborForSnapshot(rows as Record<string, unknown>[])
  const hourlyBuckets = await fetchLaborByBusinessDateHour(db, {
    startDate: businessDate,
    endDate: businessDate,
    locationId,
  })
  const hourly: DailyOpsSnapshotLaborSection['hourly'] = [...hourlyBuckets.entries()]
    .map(([key, bucket]) => {
      const hour = Number(key.split('|')[1])
      return {
        calendar_hour: hour,
        hours: round2(bucket.hours),
        loaded_cost: round2(bucket.loadedCost),
      }
    })
    .filter((slot) => Number.isFinite(slot.calendar_hour) && (slot.hours > 0 || slot.loaded_cost > 0))
    .sort((a, b) => a.calendar_hour - b.calendar_hour)

  if (DEBUG) {
    const fb = workers.filter((w) => w.loaded_cost_fallback).length
    console.info(
      `[snapshot:build] ${businessDate} ${locationName} | labor | rows=${rows.length} hours=${totals.hours.toFixed(2)} hourly=${hourly.length} gewerkt=${operationalRollup?.totals_gewerkt.hours ?? 0} fallback=${fb}/${workers.length}`,
    )
  }

  const emptyOp = {
    gewerkt: emptyPair(),
    keuken: emptyPair(),
    bediening: emptyPair(),
  }

  return {
    schema_version: 1,
    laborBuildVersion: LABOR_BUILD_VERSION_WITH_HOURLY,
    businessDate,
    locationId,
    locationName,
    totals,
    totals_gewerkt: operationalRollup?.totals_gewerkt ?? emptyPair(),
    operational: operationalRollup?.operational ?? emptyOp,
    teams: Array.from(teamsMap.values()).sort((a, b) => b.loaded_cost - a.loaded_cost),
    contracts: Array.from(contractsMap.values()).sort((a, b) => b.loaded_cost - a.loaded_cost),
    hourly,
    workers: workers.sort((a, b) => b.loaded_cost - a.loaded_cost),
    lastBuiltAt: new Date(),
  }
}
