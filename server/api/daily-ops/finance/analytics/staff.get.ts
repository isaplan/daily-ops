/**
 * @registry-id: dailyOpsFinanceAnalyticsStaffGet
 * @created: 2026-08-11T13:15:00.000Z
 * @last-modified: 2026-08-11T13:15:00.000Z
 * @description: GET /api/daily-ops/finance/analytics/staff — monthly active FT/PT/ZZP
 * @last-fix: [2026-08-11] Lazy staff series for Finance Analytics Staff metric
 * @adr-ref: ADR-004, ADR-022
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/analytics.vue
 * ✓ components/daily-ops/finance/PnlAnalyticsTrendChart.vue
 */

import { getDb } from '../../../../utils/db'
import { buildPnlAnalyticsStaff } from '../../../../utils/accountingPnl/buildPnlAnalytics'
import type { AccountingPnlAnalyticsVenue } from '~/types/accounting-pnl-analytics'

const VENUES: AccountingPnlAnalyticsVenue[] = ['combined', 'vkb', 'bea', 'lat']

function parseVenue (raw: unknown): AccountingPnlAnalyticsVenue {
  const v = typeof raw === 'string' ? raw.toLowerCase() : ''
  return VENUES.includes(v as AccountingPnlAnalyticsVenue)
    ? (v as AccountingPnlAnalyticsVenue)
    : 'combined'
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event) as Record<string, unknown>
  setResponseHeader(event, 'Cache-Control', 'private, max-age=120')
  const db = await getDb()
  return buildPnlAnalyticsStaff(db, parseVenue(q.venue))
})
