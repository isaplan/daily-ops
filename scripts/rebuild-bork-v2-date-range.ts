/**
 * Rebuild V2 aggregates (`bork_sales_by_hour`, `bork_business_days`, etc.) from existing `bork_raw_data` only.
 * Does NOT read or write `bork_raw_data` content — only scans it for aggregation.
 *
 * **“Back from now to start” (fill `_v2` collections):** set a historical **order-Date** floor and end at today
 * in **one** run — `rebuildBorkSalesAggregationV2` does a single full pass over `bork_raw_data` and clears
 * `business_date` rows implied by that window. **Do not** chain disjoint weekly rebuilds newest-first:
 * register-day spill makes that drop rows at chunk edges.
 *
 * | Mode | Env |
 * |------|-----|
 * | Explicit range | `BORK_V2_START` + `BORK_V2_END` (inclusive Bork `order.Date`) |
 * | Floor → today | `BORK_V2_BACKSTOP=YYYY-MM-DD` and optional `BORK_V2_END` (default today UTC) |
 * | Default | last **2 calendar months** through today |
 *
 * Usage:
 *   BORK_V2_REBUILD_CONFIRM=1 BORK_V2_BACKSTOP=2025-11-01 node --experimental-strip-types scripts/rebuild-bork-v2-date-range.ts
 *
 * **Write suffix (rebuild):** `BORK_AGG_REBUILD_SUFFIX` (defaults `_v2`).
 * **Read suffix (API):** `BORK_AGG_VERSION_SUFFIX` (defaults `_v2`).
 * Legacy vars are still supported: `BORK_AGG_V2_REBUILD_SUFFIX`, `BORK_AGG_V2_SUFFIX`.
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

  const suffix = resolveV2RebuildCollectionSuffix()

  const endUtc = new Date()
  const endDefault = isoUtc(endUtc)

  let startDate: string
  let endDate: string
  if (process.env.BORK_V2_START && process.env.BORK_V2_END) {
    startDate = process.env.BORK_V2_START
    endDate = process.env.BORK_V2_END
  } else if (process.env.BORK_V2_START) {
    startDate = process.env.BORK_V2_START
    endDate = process.env.BORK_V2_END || endDefault
  } else if (process.env.BORK_V2_BACKSTOP) {
    startDate = process.env.BORK_V2_BACKSTOP
    endDate = process.env.BORK_V2_END || endDefault
  } else {
    const end = endUtc
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, end.getUTCDate())
    )
    startDate = isoUtc(start)
    endDate = isoUtc(end)
  }

  if (startDate > endDate) {
    console.error(`[rebuild-bork-v2-date-range] BORK_V2_START/BACKSTOP (${startDate}) must be <= BORK_V2_END (${endDate})`)
    process.exit(1)
  }

  console.log(
    `[rebuild-bork-v2-date-range] order.Date window ${startDate} .. ${endDate} (inclusive) — single full raw scan → V2 WRITE suffix: ${JSON.stringify(suffix || '')}. Reads: BORK_AGG_VERSION_SUFFIX. Writes: BORK_AGG_REBUILD_SUFFIX.`
  )

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const result = await rebuildBorkSalesAggregationV2(db, startDate, endDate, suffix)
  console.log(
    `[rebuild-bork-v2-date-range] Done: sales_by_day=${result.salesByDay}, business_days=${result.businessDays}, hours=${result.salesHours}, tables=${result.tables}, workers=${result.workers}, guests=${result.guestAccounts}, productLines=${result.productLines}`
  )

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
