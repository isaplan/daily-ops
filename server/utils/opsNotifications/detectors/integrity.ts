import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'
import type { DailyOpsSnapshotLaborSection } from '~/types/daily-ops-snapshot'
import type { OpsScanContext } from '../scanContext'

const HOUR_EPS = 0.05

function teamBucket(teamName: string): 'keuken' | 'bediening' | 'other' {
  const n = teamName.trim().toLowerCase()
  if (n === 'keuken' || n === 'afwas') return 'keuken'
  if (n === 'bediening') return 'bediening'
  return 'other'
}

function workerOperationalHours(doc: DailyOpsSnapshotLaborSection): {
  keuken: number
  bediening: number
  gewerkt: number
} {
  let keuken = 0
  let bediening = 0
  for (const worker of doc.workers ?? []) {
    const hours = Number(worker.hours ?? 0)
    if (hours <= 0) continue
    const bucket = teamBucket(String(worker.teamName ?? ''))
    if (bucket === 'keuken') keuken += hours
    if (bucket === 'bediening') bediening += hours
  }
  return { keuken, bediening, gewerkt: keuken + bediening }
}

function hasMismatch(expected: number, actual: number): boolean {
  if (expected <= HOUR_EPS && actual <= HOUR_EPS) return false
  return Math.abs(expected - actual) > HOUR_EPS
}

function staleAggregationReasons(
  agg: NonNullable<OpsScanContext['eitjeAggQualityByKey'] extends Map<string, infer V> ? V : never>,
  snapshot: DailyOpsSnapshotLaborSection | undefined,
): string[] {
  const reasons: string[] = []
  if (agg.missingTeamNameRows > 0) reasons.push(`${agg.missingTeamNameRows} row(s) missing team_name`)
  if (agg.missingLoadedCostRows > 0) reasons.push(`${agg.missingLoadedCostRows} row(s) missing total_cost_loaded`)
  const snapshotBuiltAt = snapshot?.lastBuiltAt instanceof Date ? snapshot.lastBuiltAt : null
  if (agg.latestAggregatedAt && snapshotBuiltAt && agg.latestAggregatedAt.getTime() > snapshotBuiltAt.getTime() + 60_000) {
    reasons.push('labor snapshot older than latest Eitje aggregation')
  }
  return reasons
}

function staleBorkAggregationReasons(
  agg: NonNullable<OpsScanContext['borkAggregationQualityByKey'] extends Map<string, infer V> ? V : never>,
  snapshot: NonNullable<OpsScanContext['revenueSnapshotQualityByKey'] extends Map<string, infer V> ? V : never> | undefined,
): string[] {
  const reasons: string[] = []
  if (agg.dayEx > 0 && agg.hourlyRows === 0) reasons.push('Bork day total exists but bork hourly rows are missing')
  if (agg.dayEx > 0 && agg.hourlyEx > 0 && Math.abs(agg.dayEx - agg.hourlyEx) > Math.max(1, agg.dayEx * 0.02)) {
    reasons.push('Bork hourly total does not match Bork day total')
  }
  if (agg.latestBorkAt && snapshot?.lastBuiltAt && agg.latestBorkAt.getTime() > snapshot.lastBuiltAt.getTime() + 60_000) {
    reasons.push('revenue snapshot older than latest Bork aggregate')
  }
  return reasons
}

export function detectIntegrityNotifications(ctx: OpsScanContext): OpsNotificationDto[] {
  const items: OpsNotificationDto[] = []

  for (const row of ctx.inboxUnmapped) {
    const bd = String(row.business_date ?? '')
    items.push(
      buildNotificationItem({
        kind: 'unmapped_basis_location',
        businessDate: bd || 'unknown',
        locationId: 'unmapped',
        locationName: String(row.location ?? 'Unknown'),
        message: `Basis inbox row has no location_id — parser could not match unified_location ("${row.location}").`,
        fixHint: `Add alias to unified_location for "${row.location}"; re-process inbox attachment.`,
        severity: 'warning',
        meta: { cronHour: row.cron_hour },
      }),
    )
  }

  for (const [key, agg] of ctx.borkAggregationQualityByKey) {
    if (agg.dayEx <= 0) continue
    const [businessDate, locationId] = key.split(':::') as [string, string]
    const snapshot = ctx.revenueSnapshotQualityByKey.get(key)
    const reasons = staleBorkAggregationReasons(agg, snapshot)
    if (reasons.length === 0) continue

    items.push(
      buildNotificationItem({
        kind: 'bork_revenue_aggregation_stale',
        businessDate,
        locationId,
        locationName: ctx.locName.get(locationId) ?? locationId,
        message:
          `Bork aggregation has €${agg.dayEx.toFixed(0)} ex and ${agg.hourlyRows} nonzero hourly row(s), but the revenue pipeline looks stale/incomplete: ${reasons.join('; ')}.`,
        fixHint:
          `Run Bork daily sync / V2 rebuild for ${businessDate}, then pnpm snapshots:backfill -- --start ${businessDate} --end ${businessDate} --location ${locationId}.`,
        severity: 'critical',
        meta: {
          borkDayEx: agg.dayEx,
          borkHourlyEx: agg.hourlyEx,
          borkHourlyRows: agg.hourlyRows,
          latestBorkAt: agg.latestBorkAt?.toISOString() ?? null,
          snapshotLastBuiltAt: snapshot?.lastBuiltAt?.toISOString() ?? null,
          snapshotEx: snapshot?.ex ?? null,
          snapshotHourlyNonzero: snapshot?.hourlyNonzero ?? null,
        },
      }),
    )
  }

  for (const [key, agg] of ctx.eitjeAggQualityByKey) {
    if (agg.hours <= HOUR_EPS) continue
    const [businessDate, locationId] = key.split(':::') as [string, string]
    const snapshot = ctx.laborByKey.get(key)
    const reasons = staleAggregationReasons(agg, snapshot)
    if (reasons.length === 0) continue

    items.push(
      buildNotificationItem({
        kind: 'eitje_labor_aggregation_stale',
        businessDate,
        locationId,
        locationName: snapshot?.locationName ?? ctx.locName.get(locationId) ?? locationId,
        message:
          `Eitje aggregation has ${agg.rows} row(s), ${agg.hours.toFixed(1)}h, but it is not in the current enriched shape: ${reasons.join('; ')}.`,
        fixHint:
          `Run npx --yes tsx scripts/repair-labor-day.ts ${businessDate}; then inspect why the scheduled Eitje cron did not write enriched aggregation fields before snapshots.`,
        severity: 'critical',
        meta: {
          rows: agg.rows,
          hours: agg.hours,
          missingTeamNameRows: agg.missingTeamNameRows,
          missingLoadedCostRows: agg.missingLoadedCostRows,
          latestAggregatedAt: agg.latestAggregatedAt?.toISOString() ?? null,
          snapshotLastBuiltAt: snapshot?.lastBuiltAt instanceof Date ? snapshot.lastBuiltAt.toISOString() : null,
        },
      }),
    )
  }

  for (const [key, doc] of ctx.laborByKey) {
    const [businessDate, locationId] = key.split(':::') as [string, string]
    const workerHours = workerOperationalHours(doc)
    const snapKeuken = Number(doc.operational?.keuken?.hours ?? 0)
    const snapBediening = Number(doc.operational?.bediening?.hours ?? 0)
    const snapGewerkt = Number(doc.operational?.gewerkt?.hours ?? doc.totals_gewerkt?.hours ?? 0)

    if (
      !hasMismatch(workerHours.keuken, snapKeuken) &&
      !hasMismatch(workerHours.bediening, snapBediening) &&
      !hasMismatch(workerHours.gewerkt, snapGewerkt)
    ) {
      continue
    }

    items.push(
      buildNotificationItem({
        kind: 'labor_snapshot_inconsistent',
        businessDate,
        locationId,
        locationName: doc.locationName ?? ctx.locName.get(locationId) ?? locationId,
        message:
          `Labor snapshot workers do not match operational totals: workers keuken ${workerHours.keuken.toFixed(1)}h / bediening ${workerHours.bediening.toFixed(1)}h, ` +
          `snapshot operational keuken ${snapKeuken.toFixed(1)}h / bediening ${snapBediening.toFixed(1)}h.`,
        fixHint:
          'Fix the labor snapshot writer so operational/gewerkte totals are derived from the same worker/team rows. Reader fallback may mask this, but the snapshot invariant is broken.',
        severity: 'critical',
        meta: {
          workerKeukenHours: workerHours.keuken,
          workerBedieningHours: workerHours.bediening,
          workerGewerktHours: workerHours.gewerkt,
          snapshotKeukenHours: snapKeuken,
          snapshotBedieningHours: snapBediening,
          snapshotGewerktHours: snapGewerkt,
        },
      }),
    )
  }

  return items
}
