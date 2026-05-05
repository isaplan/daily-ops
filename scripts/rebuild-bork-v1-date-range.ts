/**
 * Rebuild **legacy** Bork aggregates (`bork_sales_by_hour`, `bork_sales_by_table`, … **no** collection suffix)
 * from `bork_raw_data` (`endpoint: bork_daily`). Uses current `calendarToBusinessDay` in
 * `server/services/borkRebuildAggregationService.ts` (08:00 register boundary).
 *
 * **Why a range, not one day:** tickets after midnight land on the **next calendar `date`** but share the
 * previous register `business_date`. Rebuild must include those order dates or stale rows remain.
 *
 * Usage:
 *   BORK_V1_REBUILD_CONFIRM=1 node --experimental-strip-types scripts/rebuild-bork-v1-date-range.ts
 *
 * Optional env:
 *   BORK_V1_START=YYYY-MM-DD  BORK_V1_END=YYYY-MM-DD   (order `Date` window; both inclusive)
 * If unset: last **14** calendar days ending today (UTC) — enough for spill into next day.
 *
 * Optional suffix (usually empty for day-breakdown):
 *   BORK_AGG_V1_SUFFIX=   (default '')
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { rebuildBorkSalesAggregation } from '../server/services/borkRebuildAggregationService.ts'

function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && process.env[m[1].trim()] === undefined) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

function isoUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

async function main() {
  if (process.env.BORK_V1_REBUILD_CONFIRM !== '1') {
    console.error('Set BORK_V1_REBUILD_CONFIRM=1 to rebuild V1 aggregates from raw (no raw writes).')
    process.exit(1)
  }

  loadDotEnv()
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  if (!uri) {
    console.error('Missing MONGODB_URI (or DATABASE_URL)')
    process.exit(1)
  }

  let startDate: string
  let endDate: string
  if (process.env.BORK_V1_START && process.env.BORK_V1_END) {
    startDate = process.env.BORK_V1_START
    endDate = process.env.BORK_V1_END
  } else {
    const end = new Date()
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 13))
    startDate = isoUtc(start)
    endDate = isoUtc(end)
  }

  const suffix = process.env.BORK_AGG_V1_SUFFIX ?? ''

  console.log(
    `[rebuild-bork-v1-date-range] order.Date window ${startDate} .. ${endDate} (inclusive), suffix=${JSON.stringify(suffix)}`
  )

  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)

  const result = await rebuildBorkSalesAggregation(db, startDate, endDate, suffix, new Date())
  console.log(
    `[rebuild-bork-v1-date-range] Done: byCron=${result.byCron}, byHour=${result.byHour}, byTable=${result.byTable}, byWorker=${result.byWorker}, byGuestAccount=${result.byGuestAccount}, productsMaster=${result.productsMaster}`
  )

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
