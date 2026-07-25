/**
 * @registry-id: staffOrgWeekdayRevenueShare
 * @created: 2026-07-22T23:00:00.000Z
 * @last-modified: 2026-07-22T23:00:00.000Z
 * @description: Historical weekday revenue share for a calendar month (multi-year)
 * @last-fix: [2026-07-22] Sept ratio from revenue snapshots (Mon=0…Sun=6)
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/api/staff-org/weekday-revenue-share.get.ts
 * ✓ components/staffOrg/StaffOrgBoard.vue
 */

import type { Db } from 'mongodb'
import type { StaffOrgWeekday } from '~/types/staff-org'
import { amsterdamWeekdayMon0 } from '~/utils/dailyOpsVenueOpeningHours'

export type WeekdayRevenueShare = {
  weekday: StaffOrgWeekday
  /** Share of monthly revenue (sums ~1 across open days). */
  share: number
  sampleDays: number
  avgDailyRevenue: number
}

/**
 * Average weekday mix for `month` (1–12) across given years.
 * Uses daily_ops_snapshot_section_revenue.totals.ex_vat.
 */
export async function buildWeekdayRevenueShares(
  db: Db,
  args: {
    locationId: string
    month: number
    years: number[]
  },
): Promise<WeekdayRevenueShare[]> {
  const month = args.month
  if (month < 1 || month > 12) return emptyShares()

  const orRanges = args.years.map((y) => {
    const mm = String(month).padStart(2, '0')
    const last = new Date(Date.UTC(y, month, 0)).getUTCDate()
    return {
      businessDate: {
        $gte: `${y}-${mm}-01`,
        $lte: `${y}-${mm}-${String(last).padStart(2, '0')}`,
      },
    }
  })

  const docs = await db.collection('daily_ops_snapshot_section_revenue').find({
    locationId: args.locationId,
    $or: orRanges,
  }, {
    projection: { businessDate: 1, 'totals.ex_vat': 1 },
  }).toArray()

  const sumByWd = new Array(7).fill(0) as number[]
  const countByWd = new Array(7).fill(0) as number[]

  for (const doc of docs) {
    const ymd = String(doc.businessDate ?? '')
    if (!ymd) continue
    const rev = Number((doc.totals as { ex_vat?: number } | undefined)?.ex_vat) || 0
    if (rev <= 0) continue
    const wd = amsterdamWeekdayMon0(ymd)
    sumByWd[wd] += rev
    countByWd[wd] += 1
  }

  const total = sumByWd.reduce((a, b) => a + b, 0)
  return ([0, 1, 2, 3, 4, 5, 6] as StaffOrgWeekday[]).map((weekday) => ({
    weekday,
    share: total > 0 ? sumByWd[weekday]! / total : 0,
    sampleDays: countByWd[weekday]!,
    avgDailyRevenue: countByWd[weekday]! > 0
      ? Math.round((sumByWd[weekday]! / countByWd[weekday]!) * 100) / 100
      : 0,
  }))
}

function emptyShares(): WeekdayRevenueShare[] {
  return ([0, 1, 2, 3, 4, 5, 6] as StaffOrgWeekday[]).map((weekday) => ({
    weekday,
    share: 0,
    sampleDays: 0,
    avgDailyRevenue: 0,
  }))
}
