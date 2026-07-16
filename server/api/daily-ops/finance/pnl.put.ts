/**
 * @registry-id: dailyOpsFinancePnlPut
 * @created: 2026-07-16T00:00:00.000Z
 * @last-modified: 2026-07-16T00:00:00.000Z
 * @description: PUT /api/daily-ops/finance/pnl — upsert accounting P&L benchmarks.
 * @last-fix: [2026-07-16] Manual edit save; seals parents + combined; optional assumptions refresh
 * @role-ref: MUST restrict to admin|owner when RBAC is implemented — currently open for dev
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/pnl.vue
 */

import { getDb } from '../../../utils/db'
import { upsertAccountingPnlBenchmarkPeriods } from '../../../utils/accountingPnlBenchmarkService'
import type {
  AccountingPnlBenchmarkUpsertRequest,
  AccountingPnlBenchmarkUpsertResponse,
} from '~/types/accounting-pnl-benchmark'
import type { AccountingPnlVenueId } from '~/utils/accountingPnlData'

const VENUE_IDS: AccountingPnlVenueId[] = ['vkb', 'bea', 'lat']

export default defineEventHandler(async (event): Promise<AccountingPnlBenchmarkUpsertResponse> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<AccountingPnlBenchmarkUpsertRequest>(event)
  if (!body?.periods?.length) {
    throw createError({ statusCode: 400, statusMessage: 'periods[] required' })
  }

  for (const period of body.periods) {
    if (!period.venues || typeof period.venues !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'Each period requires venues' })
    }
    for (const id of VENUE_IDS) {
      if (!period.venues[id]) {
        throw createError({ statusCode: 400, statusMessage: `Missing venue ${id}` })
      }
    }
  }

  const db = await getDb()
  // TODO(role-rbac): require session member role admin|owner before save
  return upsertAccountingPnlBenchmarkPeriods(db, body.periods, {
    refreshAssumptions: body.refreshAssumptions !== false,
  })
})
