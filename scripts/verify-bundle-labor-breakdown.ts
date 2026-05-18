/**
 * scripts/verify-bundle-labor-breakdown.ts
 *
 * Simulates what /api/daily-ops/metrics/bundle returns for the labor card,
 * using the same aggregateLaborForRange helper the endpoint calls.
 */
import { MongoClient } from 'mongodb'
import { aggregateLaborForRange } from '../server/utils/dailyOpsSnapshot/aggregateLaborForRange'

async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  const breakdown = await aggregateLaborForRange(db, {
    startDate: '2026-05-12',
    endDate: '2026-05-12',
    locationId: '69d6cfa63d2adf93b79d1ae7',
  })

  console.log(JSON.stringify(breakdown, null, 2))
  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
