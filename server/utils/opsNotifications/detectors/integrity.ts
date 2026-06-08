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
