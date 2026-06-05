/**
 * Pre-generate cascading JSON cache for dashboard bundles (instant page loads).
 * 
 * Cascade: daily → weekly → monthly → yearly
 * 
 * Usage: npx tsx scripts/pregenerate-dashboard-bundles.ts [--days 60]
 */

import { MongoClient } from 'mongodb'
import { preGenerateBundlesForRange } from '../server/utils/dailyOpsSnapshot/preGenerateBundleCache'
import { cascadeGenerate } from '../server/utils/dailyOpsSnapshot/cacheCascade'

async function loadEnv() {
  try {
    const { config } = await import('dotenv')
    config()
  }
  catch {
    // dotenv not available or already loaded
  }
}

function arg(name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : defaultValue
}

async function main() {
  await loadEnv()
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  const days = Number.parseInt(arg('days', '60') ?? '60', 10)
  const endDate = new Date().toISOString().slice(0, 10)
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

  console.log(`[bundle:pregen] Generating cache for ${startDate}..${endDate} (${days} days)`)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db()

  // Get all location IDs that have data in range
  const locationIds = new Set<string>(['all'])
  const snaps = await db
    .collection('daily_ops_snapshot_master')
    .find({ businessDate: { $gte: startDate, $lte: endDate } })
    .project({ locationId: 1 })
    .toArray()

  for (const snap of snaps) {
    locationIds.add(String(snap.locationId))
  }

  const dailyResult = await preGenerateBundlesForRange(db, startDate, endDate, Array.from(locationIds))

  console.log(`[bundle:pregen] Daily: ${dailyResult.generated} generated, ${dailyResult.errors} errors`)

  // Cascade: generate weekly/monthly/yearly from daily bundles
  const cascadeResult = await cascadeGenerate(startDate, endDate, Array.from(locationIds))

  console.log(
    `[bundle:pregen] Cascade: weekly=${cascadeResult.weekly}, monthly=${cascadeResult.monthly}, yearly=${cascadeResult.yearly}`,
  )
  console.log(`[bundle:pregen] Done: ${dailyResult.generated} daily + ${cascadeResult.weekly + cascadeResult.monthly + cascadeResult.yearly} aggregated`)

  await client.close()
  process.exit(dailyResult.errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
