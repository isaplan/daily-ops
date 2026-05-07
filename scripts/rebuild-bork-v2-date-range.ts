/**
 * Rebuild V2 Bork aggregates (`bork_business_days`, `bork_sales_by_hour`, `bork_sales_by_product`, …)
 * from `bork_raw_data` (`endpoint: bork_daily`). See `server/services/borkRebuildAggregationV2Service.ts`.
 *
 * Usage:
 *   BORK_V2_REBUILD_CONFIRM=1 node --experimental-strip-types scripts/rebuild-bork-v2-date-range.ts
 *
 * Optional env:
 *   BORK_V2_START=YYYY-MM-DD  BORK_V2_END=YYYY-MM-DD   (order `Date` window; both inclusive)
 * If unset: last **14** calendar days ending today (UTC).
 *
 * Suffix (collection version): use `server/utils/borkV2RebuildSuffix.ts` / `BORK_AGG_V2_REBUILD_SUFFIX` (default `_v2`).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { rebuildBorkSalesAggregationV2 } from '../server/services/borkRebuildAggregationV2Service.ts'
import { resolveV2RebuildCollectionSuffix } from '../server/utils/borkV2RebuildSuffix.ts'

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
  if (process.env.BORK_V2_REBUILD_CONFIRM !== '1') {
    console.error('Set BORK_V2_REBUILD_CONFIRM=1 to rebuild V2 aggregates from raw (no raw writes).')
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
  if (process.env.BORK_V2_START && process.env.BORK_V2_END) {
    startDate = process.env.BORK_V2_START
    endDate = process.env.BORK_V2_END
  } else {
    const end = new Date()
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 13))
    startDate = isoUtc(start)
    endDate = isoUtc(end)
  }

  const suffix = resolveV2RebuildCollectionSuffix()

  console.log(
    `[rebuild-bork-v2-date-range] order.Date window ${startDate} .. ${endDate} (inclusive), suffix=${JSON.stringify(suffix)}`
  )

  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)

  const result = await rebuildBorkSalesAggregationV2(db, startDate, endDate, suffix)
  console.log(
    `[rebuild-bork-v2-date-range] Done: business_days=${result.businessDays}, sales_by_day=${result.salesByDay}, hours=${result.salesHours}, tables=${result.tables}, workers=${result.workers}, guests=${result.guestAccounts}, product_lines=${result.productLines}`
  )

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
