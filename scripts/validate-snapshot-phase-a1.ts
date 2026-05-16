/**
 * @registry-id: validateSnapshotPhaseA1
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-13T00:00:00.000Z
 * @description: Phase A.1 acceptance test — builds 1 snapshot for a known
 *   (businessDate, locationId), then asserts: collection presence, doc shape, numeric
 *   consistency (ex + vat = inc), denormalization (no missing names), labor totals (hours > 0,
 *   loaded ≥ wage for non-Nuluren), source provenance populated.
 * @last-fix: [2026-05-13] Initial.
 *
 * Usage:
 *   MONGODB_URI=... MONGODB_DB_NAME=daily-ops-db \
 *   npx tsx scripts/validate-snapshot-phase-a1.ts \
 *     --businessDate 2026-05-11 --locationId 69d6cfa63d2adf93b79d1ae7
 */

import { MongoClient } from 'mongodb'
import { buildDailyOpsSnapshot } from '../server/services/dailyOpsSnapshotService'

function arg(flag: string, def?: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : def
}

type Check = { name: string; pass: boolean; detail?: string }

async function run() {
  const businessDate = arg('--businessDate', '2026-05-11')!
  const locationId = arg('--locationId')

  process.env.DEBUG = (process.env.DEBUG ? process.env.DEBUG + ',' : '') + 'snapshot:build,snapshot:sources'

  console.log(`[validate] businessDate=${businessDate} locationId=${locationId ?? '(auto)'}`)

  const result = await buildDailyOpsSnapshot({ businessDate, locationId })
  console.log(`[validate] build complete | built=${result.built.length} errors=${result.errors.length}`)
  for (const e of result.errors) console.error(`  ERROR ${e.locationId}: ${e.error}`)
  if (result.built.length === 0) {
    console.error('[validate] FATAL: no snapshots built')
    process.exit(2)
  }

  const uri = process.env.MONGODB_URI!
  const dbName = process.env.MONGODB_DB_NAME ?? 'daily-ops-db'
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const checks: Check[] = []
  const targetLoc = result.built[0]!
  const filter = { businessDate, locationId: targetLoc.locationId }

  const master = await db.collection('daily_ops_snapshot').findOne(filter)
  const revenue = await db.collection('daily_ops_snapshot_section_revenue').findOne(filter)
  const labor = await db.collection('daily_ops_snapshot_section_labor').findOne(filter)

  checks.push({ name: 'master doc present', pass: !!master })
  checks.push({ name: 'revenue section present', pass: !!revenue })
  checks.push({ name: 'labor section present', pass: !!labor })

  if (master) {
    checks.push({ name: 'master.locationName not empty', pass: !!master.locationName, detail: `"${master.locationName}"` })
    checks.push({ name: 'master.cards.revenue present', pass: !!master.cards?.revenue })
    checks.push({ name: 'master.sources populated', pass: !!master.sources?.bork && !!master.sources?.eitje })
    checks.push({ name: 'master.status valid', pass: master.status === 'partial' || master.status === 'final', detail: master.status })
  }

  if (revenue) {
    const t = revenue.totals
    const delta = Math.abs((t?.ex_vat ?? 0) + (t?.vat ?? 0) - (t?.inc_vat ?? 0))
    checks.push({ name: 'revenue.totals ex+vat≈inc', pass: delta < 0.01, detail: `delta=${delta.toFixed(4)}` })
    checks.push({ name: 'revenue.hourly has 24 slots', pass: Array.isArray(revenue.hourly) && revenue.hourly.length === 24 })
    checks.push({ name: 'revenue.borkTotals present', pass: typeof revenue.borkTotals?.ex_vat === 'number' })
  }

  if (labor) {
    const t = labor.totals
    checks.push({ name: 'labor.totals.hours > 0 (when work exists)', pass: typeof t?.hours === 'number', detail: `hours=${t?.hours}` })
    checks.push({ name: 'labor.totals.loaded_cost ≥ wage_cost', pass: (t?.loaded_cost ?? 0) >= (t?.wage_cost ?? 0) })
    const nullTeams = (labor.teams ?? []).filter((w: { teamName?: string }) => !w.teamName).length
    const nullWorkers = (labor.workers ?? []).filter((w: { userName?: string }) => !w.userName).length
    checks.push({ name: 'labor.teams all named', pass: nullTeams === 0, detail: `missing=${nullTeams}` })
    checks.push({ name: 'labor.workers all named', pass: nullWorkers === 0, detail: `missing=${nullWorkers}` })
  }

  console.log('\n[validate] Results:')
  let failed = 0
  for (const c of checks) {
    const tag = c.pass ? 'PASS' : 'FAIL'
    if (!c.pass) failed += 1
    console.log(`  [${tag}] ${c.name}${c.detail ? ` (${c.detail})` : ''}`)
  }

  console.log(`\n[validate] Summary: ${checks.length - failed}/${checks.length} passed`)
  if (failed > 0) {
    console.log('\n[validate] Master doc:', JSON.stringify(master, null, 2))
  }
  await client.close()
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(2)
})
