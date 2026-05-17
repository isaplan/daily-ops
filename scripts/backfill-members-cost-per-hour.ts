/**
 * scripts/backfill-members-cost-per-hour.ts
 *
 * For every member without a cost_per_hour, scan inbox-eitje-contracts for the latest
 * row that matches by normalized employee_name (lowercase, trimmed, collapsed spaces),
 * then $set members.cost_per_hour. Also surfaces the loaded factor (cph/rate) for visual sanity.
 *
 * Live counter & dry-run guard. Usage:
 *   tsx scripts/backfill-members-cost-per-hour.ts            # dry run
 *   tsx scripts/backfill-members-cost-per-hour.ts --apply    # writes
 */

import { MongoClient } from 'mongodb'

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const APPLY = process.argv.includes('--apply')

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  const contracts = await db.collection('inbox-eitje-contracts').find({}).toArray()
  console.log(`Scanning ${contracts.length} inbox-eitje-contracts rows…`)

  // Pick latest contract per normalized name
  const latestByName = new Map<string, { cph: number | null; rate: number | null; importedAt: Date | null; name: string }>()
  for (const c2 of contracts) {
    const key = norm(c2.employee_name)
    if (!key) continue
    const cph = typeof c2.cost_per_hour === 'number' ? c2.cost_per_hour : null
    const rate = typeof c2.hourly_rate === 'number' ? c2.hourly_rate : null
    const t = c2.importedAt ? new Date(c2.importedAt as string | Date) : null
    const prior = latestByName.get(key)
    if (!prior || (t && (!prior.importedAt || t > prior.importedAt))) {
      latestByName.set(key, { cph, rate, importedAt: t, name: String(c2.employee_name) })
    }
  }
  console.log(`Built name→latest-contract map: ${latestByName.size} unique names`)

  const members = await db.collection('members').find({}).toArray()
  let matched = 0
  let updated = 0
  let skippedNoCph = 0
  let skippedAlreadySet = 0
  let unmatched = 0
  const writes: Array<{ filter: any; set: any; name: string; cph: number; rate: number | null }> = []

  for (const m of members) {
    const key = norm(m.name)
    if (!key) { unmatched++; continue }
    const hit = latestByName.get(key)
    if (!hit) { unmatched++; continue }
    matched++
    if (typeof m.cost_per_hour === 'number') { skippedAlreadySet++; continue }
    if (hit.cph == null) { skippedNoCph++; continue }
    writes.push({
      filter: { _id: m._id },
      set: {
        cost_per_hour: hit.cph,
        cost_per_hour_source: 'inbox-eitje-contracts',
        cost_per_hour_synced_at: new Date(),
      },
      name: String(m.name),
      cph: hit.cph,
      rate: hit.rate,
    })
  }

  console.log(`\nResults:`)
  console.log(`  members total:                ${members.length}`)
  console.log(`  matched by name:              ${matched}`)
  console.log(`  unmatched (no contract row):  ${unmatched}`)
  console.log(`  skipped (already set):        ${skippedAlreadySet}`)
  console.log(`  skipped (contract cph null):  ${skippedNoCph}`)
  console.log(`  pending writes:               ${writes.length}`)
  console.log(`\nFirst 10 writes:`)
  for (const w of writes.slice(0, 10)) {
    const factor = w.rate ? (w.cph / w.rate).toFixed(2) : '—'
    console.log(`  ${w.name.padEnd(30)} cph=${String(w.cph).padStart(6)} rate=${String(w.rate ?? '—').padStart(6)} factor=${factor}`)
  }

  if (!APPLY) {
    console.log(`\nDry run only. Pass --apply to write.`)
    await c.close()
    return
  }

  if (writes.length === 0) {
    console.log(`Nothing to write.`)
    await c.close()
    return
  }

  console.log(`\nApplying ${writes.length} writes…`)
  const ops = writes.map((w) => ({ updateOne: { filter: w.filter, update: { $set: w.set } } }))
  const r = await db.collection('members').bulkWrite(ops, { ordered: false })
  console.log(`Done. modifiedCount=${r.modifiedCount} matchedCount=${r.matchedCount}`)
  updated = r.modifiedCount

  // Final coverage
  const withCph = await db.collection('members').countDocuments({ cost_per_hour: { $exists: true, $ne: null } })
  console.log(`Post-backfill: members with cost_per_hour = ${withCph}/${members.length}`)

  await c.close()
}

run().catch((e) => { console.error(e); process.exit(1) })
