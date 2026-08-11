/**
 * @registry-id: fetchSealedMonthlyPnlRows
 * @created: 2026-07-24T11:30:00.000Z
 * @last-modified: 2026-08-11T12:55:00.000Z
 * @description: Load sealed monthly accounting_pnl_benchmark docs (revenue > 0)
 * @last-fix: [2026-08-11] Optional unlimited fetch for Finance Analytics
 * @adr-ref: ADR-014, ADR-022
 *
 * @exports-to:
 * ✓ server/utils/accountingPnl/buildBreakEvenAssumptions.ts
 * ✓ server/utils/accountingPnl/refreshFinanceAssumptions.ts
 * ✓ server/utils/accountingPnl/buildPnlAnalytics.ts
 * ✓ server/utils/staffOrg/laborBenchmarks.ts
 * ✓ server/utils/dailyOpsPeriodCache/ratioSnapshot.ts
 */

import type { Db } from 'mongodb'
import type { AccountingPnlBenchmarkPeriodDoc } from '~/types/accounting-pnl-benchmark'
import { normalizeAccountingPnlRow } from '~/utils/accountingPnlRowMath'

/** Same collection as accountingPnlBenchmarkService — keep string local to avoid import cycles. */
const COLLECTION = 'accounting_pnl_benchmark'

export type SealedMonthlyPnlDoc = {
  year: number
  month: number
  venues: AccountingPnlBenchmarkPeriodDoc['venues']
  combined: AccountingPnlBenchmarkPeriodDoc['combined']
}

export async function fetchSealedMonthlyPnlRows (
  db: Db,
  opts?: { limit?: number | null },
): Promise<SealedMonthlyPnlDoc[]> {
  const limit = opts?.limit === null ? null : (opts?.limit ?? 24)
  let cursor = db
    .collection<AccountingPnlBenchmarkPeriodDoc>(COLLECTION)
    .find({ month: { $ne: null, $gte: 1, $lte: 12 } })
    .sort({ year: -1, month: -1 })
  if (limit != null) cursor = cursor.limit(Math.max(limit * 2, limit))

  const docs = await cursor.toArray()
  const out: SealedMonthlyPnlDoc[] = []
  for (const doc of docs) {
    if (doc.month == null) continue
    const combined = normalizeAccountingPnlRow(doc.combined)
    if (combined.revenue <= 0) continue
    out.push({
      year: doc.year,
      month: doc.month,
      venues: {
        vkb: normalizeAccountingPnlRow(doc.venues.vkb),
        bea: normalizeAccountingPnlRow(doc.venues.bea),
        lat: normalizeAccountingPnlRow(doc.venues.lat),
      },
      combined,
    })
    if (limit != null && out.length >= limit) break
  }
  return out
}
