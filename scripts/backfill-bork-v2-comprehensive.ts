/**
 * Comprehensive V2 backfill: rebuilds from oldest raw data to today
 * Queries bork_raw_data to find earliest date, then rebuilds all aggregates
 * 
 * Usage:
 *   BORK_V2_REBUILD_CONFIRM=1 node --experimental-strip-types scripts/backfill-bork-v2-comprehensive.ts
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

async function findOldestRawData(db: any): Promise<string | null> {
  try {
    // Find oldest by rawApiResponse[0].Date (YYYYMMDD format)
    const oldest = await db
      .collection('bork_raw_data')
      .find({ 'rawApiResponse.0.Date': { $exists: true } })
      .sort({ 'rawApiResponse.0.Date': 1 })
      .limit(1)
      .toArray()
    
    if (!oldest || !oldest.length || !oldest[0].rawApiResponse?.[0]?.Date) {
      console.error('[backfill-v2] Could not find Date in rawApiResponse[0]')
      return null
    }
    
    // Convert YYYYMMDD to YYYY-MM-DD
    const dateStr = String(oldest[0].rawApiResponse[0].Date)
    const year = dateStr.slice(0, 4)
    const month = dateStr.slice(4, 6)
    const day = dateStr.slice(6, 8)
    return `${year}-${month}-${day}`
  } catch (e) {
    console.error('[backfill-v2] Query error:', e)
    return null
  }
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

  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)

  // Find oldest raw data date
  console.log('[backfill-v2] Finding oldest raw data...')
  const oldestDate = await findOldestRawData(db)
  if (!oldestDate) {
    console.error('[backfill-v2] No raw data found in bork_raw_data')
    await client.close()
    process.exit(1)
  }

  const today = new Date()
  const endDate = isoUtc(today)
  const startDate = oldestDate

  const suffix = resolveV2RebuildCollectionSuffix()

  console.log(
    `[backfill-v2] Comprehensive rebuild: ${startDate} .. ${endDate} (inclusive), suffix=${JSON.stringify(suffix)}`
  )
  console.log(`[backfill-v2] Total days: ${Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1}`)

  const startTime = Date.now()
  const result = await rebuildBorkSalesAggregationV2(db, startDate, endDate, suffix)
  const elapsed = Date.now() - startTime

  console.log(`[backfill-v2] ✅ Done in ${(elapsed / 1000).toFixed(1)}s`)
  console.log(`[backfill-v2] Results:`)
  console.log(`  - business_days: ${result.businessDays}`)
  console.log(`  - sales_by_day: ${result.salesByDay}`)
  console.log(`  - hours: ${result.salesHours}`)
  console.log(`  - tables: ${result.tables}`)
  console.log(`  - workers: ${result.workers}`)
  console.log(`  - guests: ${result.guestAccounts}`)
  console.log(`  - product_lines: ${result.productLines}`)

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
