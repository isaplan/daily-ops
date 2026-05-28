/**
 * @registry-id: dailyOpsMetricsBorkExprs
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Shared Mongo aggregation expressions for Bork revenue fields
 * @adr-ref: ADR-004, ADR-006
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsDashboardMetrics.ts (barrel)
 * ✓ server/utils/dailyOpsRevenue/borkRevenueRead.ts
 */

/** Prefer ex-VAT when > 0; else `total_revenue` (V2 hourly rows often omit ex-VAT field). */
export const BORK_DOC_REVENUE_EXPR = {
  $let: {
    vars: {
      ex: { $ifNull: ['$total_revenue_ex_vat', 0] },
      gross: { $ifNull: ['$total_revenue', 0] },
    },
    in: { $cond: [{ $gt: ['$$ex', 0] }, '$$ex', '$$gross'] },
  },
} as const

/** Prefer inc-VAT field; else `total_revenue` (gross). */
export const BORK_DOC_REVENUE_INC_EXPR = {
  $let: {
    vars: {
      inc: { $ifNull: ['$total_revenue_inc_vat', 0] },
      gross: { $ifNull: ['$total_revenue', 0] },
    },
    in: { $cond: [{ $gt: ['$$inc', 0] }, '$$inc', '$$gross'] },
  },
} as const
