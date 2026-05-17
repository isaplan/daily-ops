/**
 * scripts/rebuild-eitje-agg-range.ts
 *
 * Full re-aggregation of eitje_time_registration_aggregation for a date range.
 * Usage: tsx scripts/rebuild-eitje-agg-range.ts --start 2026-02-17 --end 2026-05-13
 */

import { MongoClient } from 'mongodb'
import { rebuildEitjeTimeRegistrationAggregation } from '../server/services/eitjeRebuildAggregationService'

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

async function run() {
  const start = arg('start')
  const end = arg('end')
  if (!start || !end) {
    console.error('Usage: tsx scripts/rebuild-eitje-agg-range.ts --start YYYY-MM-DD --end YYYY-MM-DD')
    process.exit(2)
  }

  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  const t0 = Date.now()
  console.log(`[eitje-rebuild] window=${start}..${end}`)
  const r = await rebuildEitjeTimeRegistrationAggregation(db, start, end)
  console.log(`[eitje-rebuild] done in ${((Date.now() - t0) / 1000).toFixed(1)}s — deletedPeriods=${r.deletedPeriods} inserted=${r.inserted}`)

  // Coverage check on new fields
  const docs = await db.collection('eitje_time_registration_aggregation').countDocuments({ period: { $gte: start, $lte: end } })
  const withCph = await db.collection('eitje_time_registration_aggregation').countDocuments({
    period: { $gte: start, $lte: end },
    cost_per_hour: { $type: 'number' },
  })
  const withLoaded = await db.collection('eitje_time_registration_aggregation').countDocuments({
    period: { $gte: start, $lte: end },
    total_cost_loaded: { $gt: 0 },
  })
  const sources = await db.collection('eitje_time_registration_aggregation').aggregate([
    { $match: { period: { $gte: start, $lte: end } } },
    { $group: { _id: '$loaded_cost_source', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray()

  console.log(`\nCoverage:`)
  console.log(`  total rows:                  ${docs}`)
  console.log(`  with numeric cost_per_hour:  ${withCph}`)
  console.log(`  with loaded > 0:             ${withLoaded}`)
  console.log(`  loaded_cost_source breakdown:`)
  for (const s of sources) console.log(`    ${String(s._id ?? '(none)').padEnd(25)} ${s.n}`)

  await c.close()
}

run().catch((e) => { console.error(e); process.exit(1) })
