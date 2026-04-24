/**
 * Rebuild V2 aggregates (`bork_sales_hours`, `bork_business_days`) from existing `bork_raw_data` only.
 * Does NOT read or write `bork_raw_data` content — only scans it for aggregation.
 *
 * Default window: last **2 calendar months** from today (UTC) through today.
 * Override: `BORK_V2_START=YYYY-MM-DD` and `BORK_V2_END=YYYY-MM-DD`
 *
 * Usage:
 *   BORK_V2_REBUILD_CONFIRM=1 node --experimental-strip-types scripts/rebuild-bork-v2-date-range.ts
 *
 * Optional: `BORK_AGG_V2_SUFFIX` (e.g. `_test`) for collection names.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { rebuildBorkSalesAggregationV2 } from '../server/services/borkRebuildAggregationV2Service.ts'

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
    console.error('Set BORK_V2_REBUILD_CONFIRM=1 to rebuild V2 from raw (no raw writes).')
    process.exit(1)
  }

  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }

  const suffix = process.env.BORK_AGG_V2_SUFFIX || ''

  let startDate: string
  let endDate: string
  if (process.env.BORK_V2_START && process.env.BORK_V2_END) {
    startDate = process.env.BORK_V2_START
    endDate = process.env.BORK_V2_END
  } else {
    const end = new Date()
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, end.getUTCDate())
    )
    startDate = isoUtc(start)
    endDate = isoUtc(end)
  }

  console.log(
    `[rebuild-bork-v2-date-range] ${startDate} .. ${endDate} → V2 collections (suffix: ${suffix || '(none)'})`
  )

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const result = await rebuildBorkSalesAggregationV2(db, startDate, endDate, suffix)
  console.log(
    `[rebuild-bork-v2-date-range] Done: days=${result.businessDays}, hours=${result.salesHours}, tables=${result.tables}, workers=${result.workers}, guests=${result.guestAccounts}, productLines=${result.productLines}`
  )

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
