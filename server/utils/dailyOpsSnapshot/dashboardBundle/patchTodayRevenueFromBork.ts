/**
 * @registry-id: dailyOpsPatchTodayRevenueFromBork
 * @created: 2026-06-06T18:00:00.000Z
 * @last-modified: 2026-06-06T18:00:00.000Z
 * @description: Override today's snapshot revenue rows with live Bork V2 aggregates
 * @adr-ref: ADR-004
 */

import type { Db } from 'mongodb'
import type { DailyOpsSnapshotRevenueSection } from '~/types/daily-ops-snapshot'
import type { DailyOpsMetricsContext } from '../../dailyOpsMetrics/context'
import { fetchBorkRangeTotals } from '../../dailyOpsRevenue/borkRevenueRead'
import { isTodayBusinessDate } from '../../venueStrip/liveRevenue'
import { snapshotRound2 } from './shared'

export async function patchTodayRevenueRowsFromBork(
  db: Db,
  ctx: DailyOpsMetricsContext,
  revenueRows: DailyOpsSnapshotRevenueSection[],
): Promise<void> {
  if (ctx.startDate !== ctx.endDate || !isTodayBusinessDate(ctx.startDate)) return

  await Promise.all(
    revenueRows.map(async (row) => {
      const live = await fetchBorkRangeTotals(db, {
        startDate: ctx.startDate,
        endDate: ctx.endDate,
        locationId: row.locationId,
      })
      if (live.revenue <= 0 && live.revenueIncVat <= 0) return

      const ex = snapshotRound2(live.revenue)
      const inc = snapshotRound2(live.revenueIncVat)
      row.totals = {
        ex_vat: ex,
        inc_vat: inc,
        vat: snapshotRound2(inc - ex),
      }
      row.leadSource = 'bork_api_merged'
      row.borkTotals = {
        ...(row.borkTotals ?? { quantity: 0, record_count: 0 }),
        ex_vat: ex,
        inc_vat: inc,
        vat: snapshotRound2(inc - ex),
      }
    }),
  )
}
