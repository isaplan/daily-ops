/**
 * @registry-id: dailyOpsSnapshotBuildLaborSection
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-14T12:00:00.000Z
 * @description: Builds DailyOpsSnapshotLaborSection for one (businessDate, locationId)
 *   from eitje_time_registration_aggregation. Reads total_cost (wages) and total_cost_loaded
 *   (loaded labor cost — Eitje-style) directly from the agg, which itself resolves cost_per_hour
 *   from inbox-eitje-contracts → members → fallback 1.36 at aggregation time.
 * @last-fix: [2026-05-20] Enrich zero-wage rows from members (ZZP hourly_rate on support_id).
 *
 * @architecture:
 *   - Eitje agg rows now carry: total_cost, total_cost_loaded, cost_per_hour, loaded_cost_source,
 *     hourly_rate (post-resolution), plus pre-denormalized location/team/user names.
 *   - Eitje period == business_date (no shift starts in 00:00–07:59 window).
 *   - No $lookup at snapshot build time — pure projection / aggregation in app.
 *
 * @exports-to:
 *   ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { enrichEitjeAggRowsFromMembers } from '../eitjeAggCompensationEnrich'
import type {
  DailyOpsSnapshotLaborSection,
  LaborCostPair,
} from '../../../types/daily-ops-snapshot'

const DEBUG = String(process.env.DEBUG ?? '').includes('snapshot:build')

export type BuildLaborInput = {
  businessDate: string
  locationId: string
  locationName: string
}

function emptyPair(): LaborCostPair {
  return { hours: 0, wage_cost: 0, loaded_cost: 0, record_count: 0 }
}

export async function buildLaborSection(
  db: Db,
  input: BuildLaborInput
): Promise<DailyOpsSnapshotLaborSection> {
  const { businessDate, locationId, locationName } = input

  const rows = await db
    .collection('eitje_time_registration_aggregation')
    .find({ period: businessDate, locationId })
    .toArray()

  await enrichEitjeAggRowsFromMembers(db, rows as Record<string, unknown>[])

  const totals = emptyPair()
  const teamsMap = new Map<string, LaborCostPair & { teamId: string; teamName: string }>()
  const workers: DailyOpsSnapshotLaborSection['workers'] = []

  for (const r of rows) {
    const hours = Number(r.total_hours ?? 0)
    const hourlyRate = typeof r.hourly_rate === 'number' ? r.hourly_rate : null
    const wageCost = Number(r.total_cost ?? 0)
    const loadedCost = Number(r.total_cost_loaded ?? 0)
    const cph = typeof r.cost_per_hour === 'number' ? r.cost_per_hour : null
    const loadedSource = typeof r.loaded_cost_source === 'string' ? r.loaded_cost_source : 'none'
    const fallback = loadedSource === 'fallback-1.36' || loadedSource === 'none'
    const userId = String(r.userId ?? '')
    const teamId = String(r.teamId ?? '')
    const teamName = String(r.team_name ?? '')
    const userName = String(r.user_name ?? '')

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

    workers.push({
      hours,
      wage_cost: wageCost,
      loaded_cost: loadedCost,
      record_count: 1,
      userId,
      userName,
      teamId,
      teamName,
      hourly_rate: hourlyRate,
      cost_per_hour: cph,
      loaded_cost_fallback: fallback,
    })
  }

  if (DEBUG) {
    const fb = workers.filter((w) => w.loaded_cost_fallback).length
    console.info(
      `[snapshot:build] ${businessDate} ${locationName} | labor | rows=${rows.length} hours=${totals.hours.toFixed(2)} wage=${totals.wage_cost.toFixed(2)} loaded=${totals.loaded_cost.toFixed(2)} fallback=${fb}/${workers.length}`
    )
  }

  return {
    schema_version: 1,
    businessDate,
    locationId,
    locationName,
    totals,
    teams: Array.from(teamsMap.values()).sort((a, b) => b.loaded_cost - a.loaded_cost),
    workers: workers.sort((a, b) => b.loaded_cost - a.loaded_cost),
    lastBuiltAt: new Date(),
  }
}
