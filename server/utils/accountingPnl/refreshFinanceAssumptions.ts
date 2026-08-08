/**
 * @registry-id: refreshFinanceAssumptions
 * @created: 2026-07-24T11:30:00.000Z
 * @last-modified: 2026-08-05T00:05:00.000Z
 * @description: Rebuild PNL_ASSUMPTIONS + BREAK_EVEN_ASSUMPTIONS from sealed monthly P&L
 * @last-fix: [2026-08-05] ADR-020/022: refresh feeds cache cascade; BE uses ADR-019 math
 * @adr-ref: ADR-013, ADR-014, ADR-019, ADR-020, ADR-022
 *
 * @exports-to:
 * ✓ server/utils/accountingPnlBenchmarkService.ts
 * ✓ server/api/daily-ops/finance/pnl/recalculate.post.ts
 */

import type { Db } from 'mongodb'
import { accountingPnlAssumptionsFromRow } from '~/utils/accountingPnlAssumptions'
import { sumPnlRowsForBreakEven } from '~/utils/accountingPnlBreakEvenMath'
import { savePnlAssumptions } from '../appSettings/pnlAssumptionsSetting'
import { saveBreakEvenAssumptions } from '../appSettings/breakEvenAssumptionsSetting'
import { buildBreakEvenAssumptionsFromMonths } from './buildBreakEvenAssumptions'
import { fetchSealedMonthlyPnlRows } from './fetchSealedMonthlyPnlRows'

export type RefreshFinanceAssumptionsResult = {
  assumptionsUpdated: boolean
  breakEvenUpdated: boolean
  monthsUsed: number
}

/** Recompute org P&L % assumptions + break-even doc from last 12 sealed months. */
export async function refreshFinanceAssumptions (db: Db): Promise<RefreshFinanceAssumptionsResult> {
  const months = await fetchSealedMonthlyPnlRows(db, { limit: 12 })
  if (!months.length) {
    return { assumptionsUpdated: false, breakEvenUpdated: false, monthsUsed: 0 }
  }

  const combinedRows = months.map((m) => m.combined)
  const avgCombined = sumPnlRowsForBreakEven(combinedRows)
  let assumptionsUpdated = false
  if (avgCombined && avgCombined.revenue > 0) {
    await savePnlAssumptions(db, accountingPnlAssumptionsFromRow(avgCombined))
    assumptionsUpdated = true
  }

  const beValue = buildBreakEvenAssumptionsFromMonths(months)
  await saveBreakEvenAssumptions(db, beValue)

  return {
    assumptionsUpdated,
    breakEvenUpdated: true,
    monthsUsed: months.length,
  }
}
