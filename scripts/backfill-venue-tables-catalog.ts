/**
 * Backfill `daily_ops_venue_tables` from existing `bork_sales_by_table*` rows.
 *
 * @run: pnpm run tables:backfill-catalog
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import { listBorkAggReadSuffixCandidates } from '../server/utils/borkAggVersionSuffix'
import { normalizeLocationId } from '../server/utils/dailyOpsVenueTables/collection'
import { upsertKnownVenueTables } from '../server/utils/dailyOpsVenueTables/upsertKnownTables'
import { extractBorkTableNumber } from '../server/utils/bork/extractBorkTableNumber'

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

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) {
    console.error('MONGODB_URI / DATABASE_URL required')
    process.exit(1)
  }
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops'
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  let totalUpserts = 0
  for (const suffix of listBorkAggReadSuffixCandidates()) {
    const coll = `bork_sales_by_table${suffix}`
    const exists = await db.listCollections({ name: coll }).hasNext()
    if (!exists) continue

    const rows = await db
      .collection(coll)
      .aggregate<{
        locationId: unknown
        locationName?: string
        tableNum: string
        lastBusinessDate?: string
      }>([
        {
          $group: {
            _id: {
              locationId: '$locationId',
              tableNumber: '$tableNumber',
            },
            locationName: { $last: '$locationName' },
            lastBusinessDate: { $max: '$business_date' },
          },
        },
        {
          $project: {
            _id: 0,
            locationId: '$_id.locationId',
            tableNum: '$_id.tableNumber',
            locationName: 1,
            lastBusinessDate: 1,
          },
        },
      ])
      .toArray()

    const sightings = rows
      .map((r) => {
        const tableNum =
          extractBorkTableNumber({ tableNumber: r.tableNum, tableNum: r.tableNum }) ||
          String(r.tableNum ?? '').trim()
        return {
          locationId: normalizeLocationId(r.locationId),
          locationName: r.locationName,
          tableNum,
          businessDate: r.lastBusinessDate,
        }
      })
      .filter((s) => s.locationId && s.tableNum)

    const n = await upsertKnownVenueTables(db, sightings)
    totalUpserts += n
    console.log(`[tables:backfill] ${coll}: ${sightings.length} distinct · upserted/touched ${n}`)
  }

  const catalogCount = await db.collection('daily_ops_venue_tables').countDocuments()
  console.log(`[tables:backfill] done · catalog size=${catalogCount} · writes=${totalUpserts}`)
  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
