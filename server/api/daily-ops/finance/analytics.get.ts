/**
 * @registry-id: dailyOpsFinanceAnalyticsGet
 * @created: 2026-08-11T12:55:00.000Z
 * @last-modified: 2026-08-11T12:55:00.000Z
 * @description: GET /api/daily-ops/finance/analytics — sealed P&L full-history analytics
 * @last-fix: [2026-08-11] Initial endpoint for Finance Analytics page
 * @adr-ref: ADR-022
 * @data-source: direct-db
 * @read-cache-json: none
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/analytics.vue
 */

import { getDb } from '../../../utils/db'
import { buildPnlAnalytics } from '../../../utils/accountingPnl/buildPnlAnalytics'
import type { AccountingPnlAnalyticsDto, AccountingPnlAnalyticsVenue } from '~/types/accounting-pnl-analytics'

const VENUES: AccountingPnlAnalyticsVenue[] = ['combined', 'vkb', 'bea', 'lat']

function parseVenue (raw: unknown): AccountingPnlAnalyticsVenue {
  const v = typeof raw === 'string' ? raw.toLowerCase() : ''
  return VENUES.includes(v as AccountingPnlAnalyticsVenue)
    ? (v as AccountingPnlAnalyticsVenue)
    : 'combined'
}

export default defineEventHandler(async (event): Promise<AccountingPnlAnalyticsDto> => {
  const q = getQuery(event) as Record<string, unknown>
  setResponseHeader(event, 'Cache-Control', 'private, max-age=120')
  const db = await getDb()
  return buildPnlAnalytics(db, parseVenue(q.venue))
})
