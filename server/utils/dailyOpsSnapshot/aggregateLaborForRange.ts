/**
 * @registry-id: dailyOpsSnapshotAggregateLaborForRange
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-06-07T00:00:00.000Z
 * @last-fix: [2026-06-07] Live Eitje path uses open register business_date (ADR-010), not UTC ISO
 *   Prior: [2026-06-05] For today: read live eitje_time_registration_aggregation (real-time labor). For yesterday+: read snapshot (sealed).
 * @adr-ref: ADR-010
 *
 * @architecture:
 *   - **Open register day:** Reads eitje_time_registration_aggregation (live, updates hourly)
 *   - **Sealed days:** Reads daily_ops_snapshot_section_labor (sealed snapshot)
 *   - Team bucketing: case-insensitive name match → keuken / bediening / other.
 *   - Coverage: reports daysExpected vs daysFound so caller can decide partial vs complete UX.
 *
 * @exports-to:
 *   ✓ server/api/daily-ops/metrics/bundle.get.ts (Phase A.3 wire-in)
 *   ✓ server/api/daily-ops/metrics/summary.get.ts (Phase A.3 wire-in)
 */

import type { Db } from 'mongodb'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

const DEBUG = typeof process.env.DEBUG === 'string' && process.env.DEBUG.includes('snapshot:labor-agg')

export type LaborBreakdownTeamKey = 'keuken' | 'bediening' | 'other'

export type LaborBreakdownTeam = {
  key: LaborBreakdownTeamKey
  label: string
  wages: number
  loaded: number
  hours: number
}

export type LaborBreakdown = {
  wages: number
  loaded: number
  hours: number
  byTeam: LaborBreakdownTeam[]
  coverage: {
    daysFound: number
    daysExpected: number
    locationsFound: number
  }
}

const TEAM_LABELS: Record<LaborBreakdownTeamKey, string> = {
  keuken: 'Keuken',
  bediening: 'Bediening',
  other: 'Other',
}

function bucketTeam(name: string): LaborBreakdownTeamKey {
  const n = (name ?? '').trim().toLowerCase()
  if (n === 'keuken') return 'keuken'
  if (n === 'bediening') return 'bediening'
  return 'other'
}

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = []
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  let cur = Date.UTC(ys!, ms! - 1, ds!)
  const endT = Date.UTC(ye!, me! - 1, de!)
  while (cur <= endT) {
    const dt = new Date(cur)
    const p = (n: number) => String(n).padStart(2, '0')
    out.push(`${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`)
    cur += 86400000
  }
  return out
}

export async function aggregateLaborForRange(
  db: Db,
  ctx: { startDate: string; endDate: string; locationId?: string }
): Promise<LaborBreakdown> {
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const useLiveEitje = ctx.startDate === ctx.endDate && ctx.startDate === openRegister

  const collectionName = useLiveEitje ? 'eitje_time_registration_aggregation' : 'daily_ops_snapshot_section_labor'
  
  const filter: Record<string, unknown> = useLiveEitje
    ? { period: { $gte: ctx.startDate, $lte: ctx.endDate } }
    : { businessDate: { $gte: ctx.startDate, $lte: ctx.endDate } }
    
  if (ctx.locationId) filter.locationId = ctx.locationId

  const project = useLiveEitje
    ? { period: 1, locationId: 1, total_hours: 1, total_wage_cost: 1, total_loaded_cost: 1, teams: 1 }
    : { businessDate: 1, locationId: 1, totals: 1, teams: 1 }

  const docs = await db
    .collection(collectionName)
    .find(filter)
    .project(project)
    .toArray()

  const acc: Record<LaborBreakdownTeamKey, { wages: number; loaded: number; hours: number }> = {
    keuken: { wages: 0, loaded: 0, hours: 0 },
    bediening: { wages: 0, loaded: 0, hours: 0 },
    other: { wages: 0, loaded: 0, hours: 0 },
  }
  let totalWages = 0
  let totalLoaded = 0
  let totalHours = 0
  const locsFound = new Set<string>()

  for (const d of docs) {
    locsFound.add(String(d.locationId))
    
    // Handle both snapshot and live eitje schemas
    if (useLiveEitje) {
      // eitje_time_registration_aggregation: total_hours, total_wage_cost, total_loaded_cost
      totalWages += Number(d.total_wage_cost ?? 0)
      totalLoaded += Number(d.total_loaded_cost ?? 0)
      totalHours += Number(d.total_hours ?? 0)
    } else {
      // daily_ops_snapshot_section_labor: totals.wage_cost, totals.loaded_cost, totals.hours
      totalWages += Number(d.totals?.wage_cost ?? 0)
      totalLoaded += Number(d.totals?.loaded_cost ?? 0)
      totalHours += Number(d.totals?.hours ?? 0)
    }
    
    const teams = Array.isArray(d.teams) ? d.teams : []
    for (const t of teams) {
      const key = bucketTeam(t.teamName ?? '')
      acc[key].wages += Number(t.wage_cost ?? 0)
      acc[key].loaded += Number(t.loaded_cost ?? 0)
      acc[key].hours += Number(t.hours ?? 0)
    }
  }

  const days = enumerateDays(ctx.startDate, ctx.endDate)
  const expected = days.length * (ctx.locationId ? 1 : Math.max(1, locsFound.size))

  if (DEBUG) {
    console.info(
      `[snapshot:labor-agg] ${ctx.startDate}..${ctx.endDate} (${useLiveEitje ? 'live' : 'snapshot'}) loc=${ctx.locationId ?? 'all'} | docs=${docs.length} wages=${totalWages.toFixed(2)} loaded=${totalLoaded.toFixed(2)} hours=${totalHours.toFixed(2)}`
    )
  }

  return {
    wages: totalWages,
    loaded: totalLoaded,
    hours: totalHours,
    byTeam: (['keuken', 'bediening', 'other'] as const).map((k) => ({
      key: k,
      label: TEAM_LABELS[k],
      wages: acc[k].wages,
      loaded: acc[k].loaded,
      hours: acc[k].hours,
    })),
    coverage: {
      daysFound: docs.length,
      daysExpected: expected,
      locationsFound: locsFound.size,
    },
  }
}
