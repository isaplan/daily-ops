/**
 * Repair one business day: rebuild Eitje labor agg + refresh daily_ops snapshots (all locations).
 * Usage: npx --yes tsx scripts/repair-labor-day.ts 2026-05-15
 */
import { getDb } from '../server/utils/db'
import { rebuildEitjeTimeRegistrationAggregation } from '../server/services/eitjeRebuildAggregationService'
import { buildDailyOpsSnapshotRange } from '../server/services/dailyOpsSnapshotService'
import '../server/services/dailyOpsSnapshotService'

const businessDate = process.argv[2]
if (!businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
  console.error('Usage: npx --yes tsx scripts/repair-labor-day.ts YYYY-MM-DD')
  process.exit(2)
}

async function main() {
  const db = await getDb()
  console.log(`[repair-labor] Rebuilding Eitje agg for ${businessDate} ...`)
  const agg = await rebuildEitjeTimeRegistrationAggregation(db, businessDate, businessDate)
  console.log('[repair-labor] agg:', agg)

  console.log(`[repair-labor] Refreshing snapshots for ${businessDate} (all locations) ...`)
  const snap = await buildDailyOpsSnapshotRange({ startDate: businessDate, endDate: businessDate })
  console.log('[repair-labor] snapshots:', snap)

  const locs = ['69d6cfa63d2adf93b79d1ae6', '69d6cfa63d2adf93b79d1ae7', '69d6cfa73d2adf93b79d1ae8']
  const names = ['Bar Bea', 'Van Kinsbergen', "l'Amour Toujours"]
  for (let i = 0; i < locs.length; i++) {
    const [aggRow, snapRow] = await Promise.all([
      db.collection('eitje_time_registration_aggregation').aggregate([
        { $match: { period: businessDate, locationId: locs[i] } },
        { $group: { _id: null, h: { $sum: '$total_hours' }, w: { $sum: '$total_cost' }, l: { $sum: '$total_cost_loaded' }, n: { $sum: 1 } } },
      ]).toArray(),
      db.collection('daily_ops_snapshot_section_labor').findOne({ businessDate, locationId: locs[i] }),
    ])
    const a = aggRow[0] as { h?: number; w?: number; l?: number; n?: number } | undefined
    console.log(
      `[repair-labor] ${names[i]}: agg rows=${a?.n ?? 0} h=${(a?.h ?? 0).toFixed(2)} wage=${(a?.w ?? 0).toFixed(2)} loaded=${(a?.l ?? 0).toFixed(2)} | snapshot wage=${snapRow?.totals?.wage_cost ?? 0} loaded=${snapRow?.totals?.loaded_cost ?? 0}`
    )
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
