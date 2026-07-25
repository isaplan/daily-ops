/**
 * @registry-id: dailyOpsFinancePnlRecalculatePost
 * @created: 2026-07-24T11:35:00.000Z
 * @last-modified: 2026-07-24T11:35:00.000Z
 * @description: POST — rebuild P&L % assumptions + break-even from sealed monthly P&L
 * @last-fix: [2026-07-24] Recalculate without re-saving periods
 * @adr-ref: ADR-014
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/pnl.vue
 */

import { getDb } from '../../../../utils/db'
import { refreshFinanceAssumptions } from '../../../../utils/accountingPnl/refreshFinanceAssumptions'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const db = await getDb()
  // TODO(role-rbac): require session member role admin|owner
  const result = await refreshFinanceAssumptions(db)
  return {
    ok: true,
    ...result,
  }
})
