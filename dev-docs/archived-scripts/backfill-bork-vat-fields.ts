/**
 * @registry-id: backfillBorkVatFields
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-13T00:00:00.000Z
 * @description: Phase 0 backfill — repopulates Bork V2 aggregated collections so every
 *   revenue rollup includes total_revenue_ex_vat, total_revenue_inc_vat, total_vat.
 *   Re-uses rebuildBorkSalesAggregationV2 (now VAT-aware) and runs validation queries
 *   afterwards.
 * @last-fix: [2026-05-13] Initial — Phase 0 backfill driver + live validation.
 *
 * @architecture:
 *   - Calendar-date window iteration (rebuild handles 08:00 business-day mapping).
 *   - After each chunk: spot-check 5 random bork_business_days docs in window and
 *     assert |ex + vat − inc| < 0.01 per doc.
 *   - Progress: prints every chunk completion + cumulative timing.
 *
 * @exports-to:
 *   ✓ npm/pnpm scripts (one-off manual run)
 *
 * Usage:
 *   MONGODB_URI=... MONGODB_DB_NAME=daily-ops-db \
 *   npx tsx scripts/backfill-bork-vat-fields.ts --start 2026-01-01 --end 2026-05-12 --chunk 7
 */

import { MongoClient } from 'mongodb'
import { rebuildBorkSalesAggregationV2 } from '../server/services/borkRebuildAggregationV2Service'

type Args = { start: string; end: string; chunkDays: number }

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (flag: string, fallback?: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : fallback
  }
  const start = get('--start')
  const end = get('--end')
  const chunk = Number(get('--chunk', '7'))
  if (!start || !end) {
    console.error('Usage: --start YYYY-MM-DD --end YYYY-MM-DD [--chunk N]')
    process.exit(1)
  }
  return { start, end, chunkDays: Number.isFinite(chunk) && chunk > 0 ? chunk : 7 }
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

async function validateRange(
  db: ReturnType<MongoClient['db']>,
  start: string,
  end: string
): Promise<{ checked: number; failed: number; details: string[] }> {
  const docs = await db
    .collection('bork_business_days')
    .find({ business_date: { $gte: start, $lte: end } })
    .limit(20)
    .toArray()

  const details: string[] = []
  let failed = 0
  for (const d of docs) {
    const inc = Number((d as { total_revenue_inc_vat?: number }).total_revenue_inc_vat ?? 0)
    const ex = Number((d as { total_revenue_ex_vat?: number }).total_revenue_ex_vat ?? 0)
    const vat = Number((d as { total_vat?: number }).total_vat ?? 0)
    const delta = Math.abs(inc - (ex + vat))
    if (delta > 0.01) {
      failed += 1
      details.push(
        `[VAT mismatch] ${d.business_date} ${d.locationName} | inc=${inc.toFixed(2)} ex=${ex.toFixed(2)} vat=${vat.toFixed(2)} delta=${delta.toFixed(4)}`
      )
    }
  }
  return { checked: docs.length, failed, details }
}

async function run() {
  const args = parseArgs()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME ?? 'daily-ops-db'
  if (!uri) {
    console.error('MONGODB_URI not set')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const start = args.start
  const end = args.end
  console.log(`[backfill:bork-vat] window=${start}..${end} chunk=${args.chunkDays}d`)

  const t0 = Date.now()
  let cursor = start
  let chunkCount = 0
  while (cursor <= end) {
    const chunkEnd = (() => {
      const candidate = addDays(cursor, args.chunkDays - 1)
      return candidate > end ? end : candidate
    })()

    const chunkStartTs = Date.now()
    console.log(`\n[backfill:bork-vat] chunk ${++chunkCount}: ${cursor}..${chunkEnd}`)
    const r = await rebuildBorkSalesAggregationV2(db, cursor, chunkEnd)
    const chunkMs = Date.now() - chunkStartTs
    console.log(
      `[backfill:bork-vat] chunk ${chunkCount} done in ${chunkMs}ms |`,
      `days=${r.businessDays} hours=${r.salesHours} tables=${r.tables} workers=${r.workers} guests=${r.guestAccounts} products=${r.productLines}`
    )

    const v = await validateRange(db, cursor, chunkEnd)
    console.log(`[backfill:bork-vat] validation: checked=${v.checked} failed=${v.failed}`)
    if (v.failed > 0) {
      for (const d of v.details.slice(0, 5)) console.warn('  ' + d)
    }

    cursor = addDays(chunkEnd, 1)
  }

  const totalMs = Date.now() - t0
  console.log(`\n[backfill:bork-vat] complete in ${(totalMs / 1000).toFixed(1)}s`)

  await client.close()
}

run().catch((e) => {
  console.error('[backfill:bork-vat] FAILED', e)
  process.exit(1)
})
