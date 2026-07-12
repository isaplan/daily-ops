/**
 * One-time backfill: regenerate totals-only dashboard-bundle JSON into Mongo daily_ops_read_cache.
 *
 * Usage:
 *   npx tsx scripts/backfill-daily-ops-read-cache.ts --from 2024-01-01
 *   npx tsx scripts/backfill-daily-ops-read-cache.ts --from 2024-01-01 --to 2026-07-01
 */

import { MongoClient } from 'mongodb'
import { config } from 'dotenv'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '../utils/dailyOpsBusinessDate'
import { refreshDashboardBundleCache } from '../server/utils/dailyOpsSnapshot/preGenerateBundleCache'

config()

function arg(name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : defaultValue
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const endDate = arg('to', openRegister)!
  const startDate = arg('from', '2024-01-01')!

  console.log(`[read-cache:backfill] ${startDate}..${endDate} → Mongo daily_ops_read_cache`)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db()

  const locationIds = await db
    .collection('daily_ops_snapshot_master')
    .distinct('locationId', { businessDate: { $gte: startDate, $lte: endDate } })

  const ids = [...locationIds.map(String), 'all']
  const result = await refreshDashboardBundleCache(db, startDate, endDate, ids)

  console.log(
    `[read-cache:backfill] done daily=${result.daily.generated} errors=${result.daily.errors} ` +
      `weekly=${result.cascade.weekly} monthly=${result.cascade.monthly} yearly=${result.cascade.yearly}`,
  )

  await client.close()
  process.exit(result.daily.errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
