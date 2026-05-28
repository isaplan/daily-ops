/**
 * @registry-id: dailyOpsDashboardBundleLaborProductivityRollups
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Best/worst revenue-per-hour day per location from snapshot labor + revenue
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/dashboardBundle/assembleLaborDto.ts
 */

import type { DailyOpsLaborMetricsDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsSnapshotLaborSection } from '~/types/daily-ops-snapshot'
import { round2 } from './shared'

export function productivityByLocationFromSnapshots(
  labor: DailyOpsSnapshotLaborSection[],
  revByDateLocation: Map<string, number>,
): DailyOpsLaborMetricsDto['productivityByLocationDay'] {
  const byLoc = new Map<string, { locationName: string; rows: { date: string; rev: number; hours: number }[] }>()
  for (const doc of labor) {
    const rev = revByDateLocation.get(`${doc.businessDate}|${doc.locationId}`) ?? 0
    const hours = Number(doc.totals?.hours ?? 0)
    let loc = byLoc.get(doc.locationId)
    if (!loc) {
      loc = { locationName: doc.locationName, rows: [] }
      byLoc.set(doc.locationId, loc)
    }
    loc.rows.push({ date: doc.businessDate, rev, hours })
  }

  const productivityByLocationDay: DailyOpsLaborMetricsDto['productivityByLocationDay'] = []
  for (const [locationId, loc] of byLoc) {
    const scored = loc.rows
      .filter((r) => r.hours > 0)
      .map((r) => ({
        date: r.date,
        revenue: round2(r.rev),
        hours: round2(r.hours),
        revenuePerLaborHour: round2(r.rev / r.hours),
      }))
    scored.sort((a, b) => b.revenuePerLaborHour - a.revenuePerLaborHour)
    productivityByLocationDay.push({
      locationId,
      locationName: loc.locationName,
      highest: scored[0]
        ? {
            date: scored[0].date,
            revenuePerLaborHour: scored[0].revenuePerLaborHour,
            revenue: scored[0].revenue,
            hours: scored[0].hours,
          }
        : null,
      lowest:
        scored.length > 1
          ? {
              date: scored[scored.length - 1]!.date,
              revenuePerLaborHour: scored[scored.length - 1]!.revenuePerLaborHour,
              revenue: scored[scored.length - 1]!.revenue,
              hours: scored[scored.length - 1]!.hours,
            }
          : null,
    })
  }
  return productivityByLocationDay
}
