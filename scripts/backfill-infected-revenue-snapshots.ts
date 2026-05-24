/**
 * Rebuild revenue snapshots that used the **wrong Basis inbox row** (pre-2026-05-18 bug).
 *
 * Old buildRevenueSection pick: cron 8 sealed, else **highest cron_hour** (usually 23).
 * Correct pick (SSOT): `pickBasisReportByCronPriority` — morning cron **7 or 8** = final yesterday.
 *
 * A snapshot is **infected** when:
 *   1. A revenue section doc exists for (businessDate, locationId), AND
 *   2. The stored headline ex-VAT ≠ correct Basis pick (ε 0.02), OR
 *      the old bug pick would differ from the correct pick (cron 7/8 vs 23).
 *
 * Usage:
 *   pnpm snapshots:backfill:infected
 *   pnpm snapshots:backfill:infected:dry-run
 *   pnpm snapshots:backfill:infected -- --start 2024-01-01 --end 2026-05-18
 *   pnpm snapshots:backfill:infected -- --location 69d6cfa63d2adf93b79d1ae6
 *
 * Requires MONGODB_URI (or DATABASE_URL) in .env / .env.local
 */

import { getDb } from '../server/utils/db'
import { buildDailyOpsSnapshot } from '../server/services/dailyOpsSnapshotService'
import {
  pickBasisReportByCronPriority,
  type BasisReportData,
} from '../server/utils/inbox/basis-report-mapper'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '../types/daily-ops-snapshot'
import {
  amsterdamOpenRegisterBusinessDateYmd,
} from '../utils/dailyOpsBusinessDate'

const REV_EPS = 0.02

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function groupKey(businessDate: string, locationId: string): string {
  return `${businessDate}:::${locationId}`
}

/** Pre-fix buildRevenueSection lead pick — for infection detection only. */
function oldBugBasisPick(reports: BasisReportData[]): BasisReportData | undefined {
  if (reports.length === 0) return undefined
  const sorted = [...reports].sort((a, b) => (a.cron_hour ?? 0) - (b.cron_hour ?? 0))
  const sealed = sorted.find((r) => r.cron_hour === 8)
  return sealed ?? sorted[sorted.length - 1]
}

async function minMaxBusinessDate(
  db: Awaited<ReturnType<typeof getDb>>,
  collection: string,
  field: string,
): Promise<{ min: string; max: string } | null> {
  const coll = db.collection(collection)
  if ((await coll.estimatedDocumentCount()) === 0) return null
  const [lo] = await coll.find().sort({ [field]: 1 }).limit(1).project({ [field]: 1 }).toArray()
  const [hi] = await coll.find().sort({ [field]: -1 }).limit(1).project({ [field]: 1 }).toArray()
  const min = lo?.[field]
  const max = hi?.[field]
  if (typeof min !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(min)) return null
  const maxStr = typeof max === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(max) ? max : min
  return { min, max: maxStr }
}

async function discoverRange(db: Awaited<ReturnType<typeof getDb>>): Promise<{
  startDate: string
  endDate: string
  sources: string[]
}> {
  const candidates: Array<{ label: string; min: string; max: string }> = []

  const inboxBd = await minMaxBusinessDate(db, 'inbox-bork-basis-report', 'business_date')
  if (inboxBd) candidates.push({ label: 'inbox-bork-basis-report (business_date)', ...inboxBd })

  const snapBd = await minMaxBusinessDate(db, DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection, 'businessDate')
  if (snapBd) candidates.push({ label: DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection, ...snapBd })

  if (candidates.length === 0) {
    throw new Error('No business dates in inbox-bork-basis-report or revenue snapshots.')
  }

  let startDate = candidates[0]!.min
  let endDate = candidates[0]!.max
  for (const c of candidates) {
    if (c.min < startDate) startDate = c.min
    if (c.max > endDate) endDate = c.max
  }

  endDate = endDate < amsterdamOpenRegisterBusinessDateYmd()
    ? endDate
    : amsterdamOpenRegisterBusinessDateYmd()

  return {
    startDate,
    endDate,
    sources: candidates.map((c) => `${c.label}: ${c.min} → ${c.max}`),
  }
}

type InfectedRow = {
  businessDate: string
  locationId: string
  snapEx: number
  correctEx: number
  oldCron: number | undefined
  correctCron: number | undefined
  deltaEx: number
}

async function findInfected(
  db: Awaited<ReturnType<typeof getDb>>,
  startDate: string,
  endDate: string,
  locationFilter?: string,
): Promise<InfectedRow[]> {
  const inboxQuery: Record<string, unknown> = {
    business_date: { $gte: startDate, $lte: endDate },
    location_id: { $exists: true, $ne: null },
  }
  if (locationFilter) inboxQuery.location_id = locationFilter

  const inboxRows = (await db
    .collection('inbox-bork-basis-report')
    .find(inboxQuery)
    .project({
      business_date: 1,
      location_id: 1,
      cron_hour: 1,
      final_revenue_ex_vat: 1,
      received_at: 1,
    })
    .toArray()) as BasisReportData[]

  const byGroup = new Map<string, BasisReportData[]>()
  for (const r of inboxRows) {
    const bd = r.business_date
    const lid = r.location_id
    if (!bd || !lid) continue
    const k = groupKey(bd, String(lid))
    if (!byGroup.has(k)) byGroup.set(k, [])
    byGroup.get(k)!.push(r)
  }

  const snapQuery: Record<string, unknown> = {
    businessDate: { $gte: startDate, $lte: endDate },
  }
  if (locationFilter) snapQuery.locationId = locationFilter

  const snapshots = await db
    .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
    .find(snapQuery)
    .project({ businessDate: 1, locationId: 1, totals: 1, leadSource: 1 })
    .toArray()

  const snapByKey = new Map<string, { ex: number; leadSource: string }>()
  for (const s of snapshots) {
    const bd = String(s.businessDate ?? '')
    const lid = String(s.locationId ?? '')
    if (!bd || !lid) continue
    const totals = s.totals as { ex_vat?: number } | undefined
    snapByKey.set(groupKey(bd, lid), {
      ex: Number(totals?.ex_vat ?? 0),
      leadSource: String(s.leadSource ?? ''),
    })
  }

  const infected: InfectedRow[] = []

  for (const [key, rows] of byGroup) {
    const snap = snapByKey.get(key)
    if (!snap) continue

    const correct = pickBasisReportByCronPriority(rows)
    const old = oldBugBasisPick(rows)
    if (!correct) continue

    const correctEx = Number(correct.final_revenue_ex_vat ?? 0)
    const snapEx = snap.ex
    const pickChanged =
      (old?.cron_hour ?? -1) !== (correct.cron_hour ?? -1) &&
      Math.abs(correctEx - Number(old?.final_revenue_ex_vat ?? 0)) > REV_EPS
    const snapWrong = Math.abs(snapEx - correctEx) > REV_EPS

    if (pickChanged || snapWrong) {
      const [businessDate, locationId] = key.split(':::') as [string, string]
      infected.push({
        businessDate,
        locationId,
        snapEx,
        correctEx,
        oldCron: old?.cron_hour,
        correctCron: correct.cron_hour,
        deltaEx: correctEx - snapEx,
      })
    }
  }

  infected.sort((a, b) => {
    if (a.businessDate !== b.businessDate) return b.businessDate.localeCompare(a.businessDate)
    return a.locationId.localeCompare(b.locationId)
  })

  return infected
}

async function main() {
  const dryRun = hasFlag('dry-run')
  const locationId = arg('location')
  const db = await getDb()

  const discovered = await discoverRange(db)
  const startDate = arg('start') ?? discovered.startDate
  const endDate = arg('end') ?? discovered.endDate

  if (startDate > endDate) {
    throw new Error(`Invalid range: start ${startDate} > end ${endDate}`)
  }

  process.stdout.write(
    [
      '[snapshot:backfill-infected]',
      `scan=${startDate}..${endDate}`,
      `location=${locationId ?? 'all'}`,
      '',
      'Date sources:',
      ...discovered.sources.map((s) => `  - ${s}`),
      '',
    ].join('\n'),
  )

  const tScan = Date.now()
  const infected = await findInfected(db, startDate, endDate, locationId)
  const scanSec = ((Date.now() - tScan) / 1000).toFixed(1)

  const totalDelta = infected.reduce((s, r) => s + r.deltaEx, 0)
  process.stdout.write(
    `Found ${infected.length} infected snapshot(s) in ${scanSec}s (Σ Δex ${totalDelta.toFixed(2)})\n`,
  )

  if (infected.length === 0) {
    process.stdout.write('Nothing to rebuild.\n')
    process.exit(0)
  }

  const preview = infected.slice(0, 15)
  for (const row of preview) {
    process.stdout.write(
      `  ${row.businessDate} ${row.locationId.slice(-6)} | snap ${row.snapEx.toFixed(0)} → ${row.correctEx.toFixed(0)} (c${row.oldCron}→c${row.correctCron}) Δ${row.deltaEx.toFixed(0)}\n`,
    )
  }
  if (infected.length > preview.length) {
    process.stdout.write(`  … and ${infected.length - preview.length} more\n`)
  }

  if (dryRun) {
    process.stdout.write('Dry run — no rebuilds.\n')
    process.exit(0)
  }

  const t0 = Date.now()
  let built = 0
  let errors = 0

  const unique = new Map<string, InfectedRow>()
  for (const row of infected) {
    unique.set(groupKey(row.businessDate, row.locationId), row)
  }
  const jobs = [...unique.values()]
  let jobIndex = 0

  for (const row of jobs) {
    jobIndex++
    const r = await buildDailyOpsSnapshot({
      businessDate: row.businessDate,
      locationId: row.locationId,
    })
    built += r.built.length
    errors += r.errors.length
    for (const e of r.errors) {
      process.stderr.write(`  ERROR ${row.businessDate} ${e.locationId}: ${e.error}\n`)
    }
    const pct = Math.round((jobIndex / jobs.length) * 100)
    process.stdout.write(
      `\r[snapshot:backfill-infected] ${row.businessDate} ${row.locationId.slice(-6)} (${jobIndex}/${jobs.length} ${pct}%) built=${built} err=${errors}`,
    )
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  process.stdout.write(
    `\nDone in ${sec}s | infected=${infected.length} location-days rebuilt=${built} errors=${errors}\n`,
  )
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
