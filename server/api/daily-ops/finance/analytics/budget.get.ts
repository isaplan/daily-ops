/**
 * @registry-id: dailyOpsFinanceAnalyticsBudgetGet
 * @created: 2026-08-12T00:15:00.000Z
 * @last-modified: 2026-08-12T00:15:00.000Z
 * @description: GET /api/daily-ops/finance/analytics/budget — 10% margin budget/forecast
 * @last-fix: [2026-08-12] Initial budget endpoint (seasonal | manual_pct)
 * @adr-ref: ADR-019, ADR-022
 * @data-source: direct-db
 * @read-cache-json: none
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/analytics.vue
 * ✓ components/daily-ops/finance/PnlBudgetForecastCard.vue
 */

import { getDb } from '../../../../utils/db'
import { buildPnlBudget } from '../../../../utils/accountingPnl/buildPnlBudget'
import type { AccountingPnlAnalyticsVenue } from '~/types/accounting-pnl-analytics'
import type { PnlBudgetDto, PnlBudgetRevenueMode } from '~/types/accounting-pnl-budget'

const VENUES: AccountingPnlAnalyticsVenue[] = ['combined', 'vkb', 'bea', 'lat']

function parseVenue (raw: unknown): AccountingPnlAnalyticsVenue {
  const v = typeof raw === 'string' ? raw.toLowerCase() : ''
  return VENUES.includes(v as AccountingPnlAnalyticsVenue)
    ? (v as AccountingPnlAnalyticsVenue)
    : 'combined'
}

function parseMode (raw: unknown): PnlBudgetRevenueMode {
  return raw === 'manual_pct' ? 'manual_pct' : 'seasonal'
}

function parseNum (raw: unknown, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export default defineEventHandler(async (event): Promise<PnlBudgetDto> => {
  const q = getQuery(event) as Record<string, unknown>
  setResponseHeader(event, 'Cache-Control', 'private, max-age=60')
  const db = await getDb()
  return buildPnlBudget(db, {
    venue: parseVenue(q.venue),
    mode: parseMode(q.mode),
    targetAvgRevenue: parseNum(q.target_avg_revenue, 160_000),
    revenuePct: parseNum(q.revenue_pct, 0),
    horizonMonths: Math.round(parseNum(q.horizon_months, 12)),
  })
})
