/**
 * Pre-generate cascading JSON cache for dashboard bundles (instant page loads).
 *
 * Cascade: daily → weekly → monthly → yearly (venue strip embedded in daily `all` files)
 *
 * Usage:
 *   npx tsx scripts/pregenerate-dashboard-bundles.ts --from 2025-01-01
 *   npx tsx scripts/pregenerate-dashboard-bundles.ts --from 2025-01-01 --to 2026-06-08
 *   npx tsx scripts/pregenerate-dashboard-bundles.ts --days 60
 *   npx tsx scripts/pregenerate-dashboard-bundles.ts --all-locations
 */

import { MongoClient } from 'mongodb'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '../utils/dailyOpsBusinessDate'
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

  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const defaultEnd = addCalendarDaysYmd(openRegister, -1)
  const days = arg('days')
  const endDate = arg('to', defaultEnd)!
  const startDate = days
    ? addCalendarDaysYmd(endDate, -(Number.parseInt(days, 10) - 1))
    : (arg('from', '2025-01-01') ?? '2025-01-01')

  const allLocations = process.argv.includes('--all-locations')

  console.log(`[bundle:pregen] Generating cache for ${startDate}..${endDate}`)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db()

  const locationIds = new Set<string>(['all'])
  if (allLocations) {
    const snaps = await db
      .collection('daily_ops_snapshot_master')
      .find({ businessDate: { $gte: startDate, $lte: endDate } })
      .project({ locationId: 1 })
      .toArray()
    for (const snap of snaps) {
      locationIds.add(String(snap.locationId))
    }
  }

  const dailyResult = await preGenerateBundlesForRange(
    db,
    startDate,
    endDate,
    Array.from(locationIds),
  )

  console.log(`[bundle:pregen] Daily: ${dailyResult.generated} generated, ${dailyResult.errors} errors`)

  const cascadeResult = await cascadeGenerate(startDate, endDate, Array.from(locationIds))

  console.log(
    `[bundle:pregen] Cascade: weekly=${cascadeResult.weekly}, monthly=${cascadeResult.monthly}, yearly=${cascadeResult.yearly}`,
  )
  console.log(
    `[bundle:pregen] Done: ${dailyResult.generated} daily + ${cascadeResult.weekly + cascadeResult.monthly + cascadeResult.yearly} aggregated`,
  )

  await client.close()
  process.exit(dailyResult.errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
