/**
 * Backfill daily_ops_period_cache (PERIOD_CACHE_ADR L2).
 *
 * Per day: seal venue + combined day nodes, then cascade week/month/year.
 * Idempotent upsert — safe to re-run or overlap chunk boundaries.
 *
 * Usage:
 *   npx --yes tsx scripts/backfill-period-cache.ts --from 2026-07-01 --to 2026-08-07
 *   npx --yes tsx scripts/backfill-period-cache.ts --from 2026-04-01 --to 2026-06-30
 *   pnpm period-cache:backfill -- --from 2026-07-01 --to 2026-08-07
 */

import { MongoClient } from 'mongodb'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '../utils/dailyOpsBusinessDate'
import { cascadePeriodRange } from '../server/utils/dailyOpsPeriodCache/cascadePeriod'
import { refreshRatioSnapshotsFromAssumptions } from '../server/utils/dailyOpsPeriodCache/ratioSnapshot'
import { sealDayNodesForDate } from '../server/utils/dailyOpsPeriodCache/sealDayNode'

async function loadEnv () {
  try {
    const { config } = await import('dotenv')
    config()
  } catch {
    // dotenv optional
  }
}

function arg (name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : defaultValue
}

async function main () {
  await loadEnv()
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const defaultEnd = addCalendarDaysYmd(openRegister, -1)
  const endDate = arg('to', defaultEnd)!
  const startDate = arg('from', '2026-07-01')!

  if (startDate > endDate) {
    console.error(`Invalid range: ${startDate} > ${endDate}`)
    process.exit(1)
  }

  console.log(`[period-cache:backfill] ${startDate}..${endDate} (open register=${openRegister})`)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db()

  const ratios = await refreshRatioSnapshotsFromAssumptions(db)
  console.log(`[period-cache:backfill] ratio snapshots written=${ratios.written}`)

  let daysOk = 0
  let daysFail = 0
  let nodesWritten = 0
  const dayErrors: string[] = []

  let cursor = startDate
  while (cursor <= endDate) {
    const result = await sealDayNodesForDate(db, cursor)
    nodesWritten += result.written
    if (result.written > 0) {
      daysOk++
    } else {
      daysFail++
    }
    for (const e of result.errors) dayErrors.push(e)
    if ((daysOk + daysFail) % 10 === 0) {
      console.log(`[period-cache:backfill] progress through ${cursor} daysOk=${daysOk} daysFail=${daysFail}`)
    }
    cursor = addCalendarDaysYmd(cursor, 1)
  }

  console.log(
    `[period-cache:backfill] days done: ok=${daysOk} fail=${daysFail} nodesWritten=${nodesWritten}`,
  )

  const cascade = await cascadePeriodRange(db, startDate, endDate)
  console.log(
    `[period-cache:backfill] cascade weekly=${cascade.weekly} monthly=${cascade.monthly} yearly=${cascade.yearly}`,
  )
  if (cascade.errors.length) {
    console.warn(`[period-cache:backfill] cascade errors (${cascade.errors.length}):`)
    for (const e of cascade.errors.slice(0, 20)) console.warn(`  ${e}`)
  }
  if (dayErrors.length) {
    console.warn(`[period-cache:backfill] day errors (${dayErrors.length}):`)
    for (const e of dayErrors.slice(0, 30)) console.warn(`  ${e}`)
  }

  console.log('[period-cache:backfill] Done')
  await client.close()
  process.exit(daysFail > 0 && daysOk === 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
