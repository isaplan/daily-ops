/**
 * @registry-id: dailyOpsVenueStripLiveRevenueRaw
 * @created: 2026-06-07T00:00:00.000Z
 * @last-modified: 2026-06-07T00:00:00.000Z
 * @description: Open register-day revenue from latest bork_raw_data (before/at aggregate rebuild)
 * @last-fix: [2026-06-07] Sum lines for business_date incl. spillover on calendar next day (ADR-010)
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/utils/venueStrip/liveRevenue.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import {
  addCalendarDaysYmd,
  calendarHourToBusinessDate,
} from '~/utils/dailyOpsBusinessDate'
import { extractLineRevenue } from '../borkVatCalculation'

function parseHour(timeStr: string | undefined): number {
  if (!timeStr) return 0
  const match = timeStr.match(/^(\d{1,2}):/)
  if (!match) return 0
  const hour = parseInt(match[1] ?? '0', 10)
  return hour >= 0 && hour <= 23 ? hour : 0
}

function orderCalendarYmd(order: Record<string, unknown>): string | null {
  const raw = String(order.Date ?? order.ActualDate ?? '').padStart(8, '0')
  if (!raw || raw === '00000000') return null
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

function ymdToBorkCompact(ymd: string): string {
  return ymd.replace(/-/g, '')
}

export type LiveRawBusinessDayTotals = {
  revenue: number
  revenueIncVat: number
  latestRawAt: Date | null
}

/** Sum line revenue for one register business_date from raw ticket pulls (calendar day + next-day spillover). */
export async function sumBusinessDateFromBorkRaw(
  db: Db,
  unifiedLocationId: string,
  businessDate: string,
): Promise<LiveRawBusinessDayTotals | null> {
  const mapping = await db.collection('bork_unified_location_mapping').findOne({
    unifiedLocationId: ObjectId.isValid(unifiedLocationId)
      ? new ObjectId(unifiedLocationId)
      : unifiedLocationId,
  })
  if (!mapping?.borkLocationId) return null

  const borkLocId = String(mapping.borkLocationId)
  const calendarDates = [businessDate, addCalendarDaysYmd(businessDate, 1)]
  let revenue = 0
  let revenueIncVat = 0
  let latestRawAt: Date | null = null

  for (const cal of calendarDates) {
    const doc = await db.collection('bork_raw_data').findOne({
      syncDedupKey: `${borkLocId}:bork_daily:${ymdToBorkCompact(cal)}`,
    })
    if (!doc) continue

    const updated = doc.updatedAt instanceof Date ? doc.updatedAt : doc._id?.getTimestamp?.()
    if (updated instanceof Date && (!latestRawAt || updated > latestRawAt)) {
      latestRawAt = updated
    }

    const tickets = Array.isArray(doc.rawApiResponse) ? doc.rawApiResponse : [doc.rawApiResponse]
    for (const ticket of tickets) {
      if (!ticket || typeof ticket !== 'object') continue

      const calendarHour = parseHour((ticket as { Time?: string }).Time)
      const orders = Array.isArray((ticket as { Orders?: unknown[] }).Orders)
        ? (ticket as { Orders: unknown[] }).Orders
        : []

      for (const order of orders) {
        if (!order || typeof order !== 'object') continue
        const calYmd = orderCalendarYmd(order as Record<string, unknown>)
        if (!calYmd) continue
        if (calendarHourToBusinessDate(calYmd, calendarHour) !== businessDate) continue

        const lines = Array.isArray((order as { Lines?: unknown[] }).Lines)
          ? (order as { Lines: unknown[] }).Lines
          : []
        for (const line of lines) {
          const { ex, inc } = extractLineRevenue(line)
          revenue += ex
          revenueIncVat += inc
        }
      }
    }
  }

  if (revenue <= 0 && revenueIncVat <= 0) return null
  return { revenue, revenueIncVat, latestRawAt }
}
