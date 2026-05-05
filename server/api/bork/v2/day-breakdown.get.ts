/**
 * @registry-id: borkDayBreakdownApi
 * @created: 2026-04-13T00:00:00.000Z
 * @last-modified: 2026-04-30T02:30:00.000Z
 * @description: Get day breakdown data for revenue verification across all dimensions
 * @last-fix: [2026-04-30] Include bork_sales_by_guest_account (no TableNr / direct) for table vs hourly reconciliation
 *
 * @exports-to:
 * ✓ pages/daily-ops/sales/day-breakdown.vue => Fetches breakdown for selected date
 */

import { getDb } from '../../../utils/db'

type HourDoc = Record<string, unknown>

function addCalendarDaysISO(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Wall-clock `date` + `hour` for synthetic rows (register opens 08:00 on `businessDate`). */
function ticketDateHourForBusinessSlot(businessDate: string, businessHour: number): { date: string; hour: number } {
  const hour = (businessHour + 8) % 24
  if (businessHour <= 15) return { date: businessDate, hour }
  return { date: addCalendarDaysISO(businessDate, 1), hour }
}

/** Ensure 24 rows per location (BH0–BH23) with zeros where Mongo has no bucket. */
function padHourlyFullRegisterDay(rows: HourDoc[], businessDate: string, location: string): HourDoc[] {
  const locations: string[] =
    location === 'all'
      ? [...new Set(rows.map((r) => String(r.locationName ?? '')).filter(Boolean))].sort()
      : [location]

  if (locations.length === 0) return rows

  const key = (loc: string, bh: number) => `${loc}\t${bh}`
  const map = new Map<string, HourDoc>()
  for (const r of rows) {
    const loc = String(r.locationName ?? '')
    const bh = r.business_hour
    if (!loc || typeof bh !== 'number') continue
    map.set(key(loc, bh), r)
  }

  const out: HourDoc[] = []
  for (const loc of locations) {
    for (let bh = 0; bh < 24; bh++) {
      const k = key(loc, bh)
      if (map.has(k)) {
        out.push(map.get(k)!)
        continue
      }
      const { date: tDate, hour: tHour } = ticketDateHourForBusinessSlot(businessDate, bh)
      out.push({
        _id: `synthetic-hour-${businessDate}-${loc}-${bh}`,
        business_date: businessDate,
        business_hour: bh,
        locationName: loc,
        date: tDate,
        hour: tHour,
        total_revenue: 0,
        total_quantity: 0,
        record_count: 0,
        products: [],
      })
    }
  }
  return out
}

/** Match rebuild register day (`business_date`); legacy rows may only have ticket `date`. */
function matchBusinessDayFilter(dateStr: string, locationQuery: Record<string, unknown>) {
  const dayOrLegacy = {
    $or: [{ business_date: dateStr }, { business_date: { $exists: false }, date: dateStr }],
  }
  if (Object.keys(locationQuery).length === 0) return dayOrLegacy
  return { $and: [dayOrLegacy, locationQuery] }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dateStr = query.date as string
  const location = (query.location as string) || 'all'

  if (!dateStr) {
    throw createError({ statusCode: 400, statusMessage: 'date parameter required (YYYY-MM-DD)' })
  }

  const db = await getDb()

  try {
    const locationQuery = location === 'all' ? {} : { locationName: location }
    const dayMatch = matchBusinessDayFilter(dateStr, locationQuery)

    // Fetch hourly breakdown (at most one row per location × business_hour for this register day)
    const hourlyRaw = await db
      .collection('bork_sales_by_hour')
      .find(dayMatch)
      .sort({ business_hour: 1, locationName: 1 })
      .toArray()

    const hourly = padHourlyFullRegisterDay(hourlyRaw as HourDoc[], dateStr, location)

    // Fetch worker breakdown
    const worker = await db
      .collection('bork_sales_by_worker')
      .find(dayMatch)
      .sort({ business_hour: 1, locationName: 1, total_revenue: -1 })
      .toArray()

    // Fetch table breakdown (orders with TableNr only)
    const table = await db
      .collection('bork_sales_by_table')
      .find(dayMatch)
      .sort({ business_hour: 1, locationName: 1, total_revenue: -1 })
      .toArray()

    // No table number: bar / guest / on-factuur — included in hourly but not in bork_sales_by_table
    const guest = await db
      .collection('bork_sales_by_guest_account')
      .find(dayMatch)
      .sort({ business_hour: 1, locationName: 1, total_revenue: -1 })
      .toArray()

    // Product master is mostly catalog; per-day lines use `business_date` when present
    const product = await db
      .collection('bork_products_master')
      .find(dayMatch)
      .sort({ total_revenue: -1 })
      .toArray()

    return {
      businessDate: dateStr,
      dateRange: {
        startDate: dateStr,
        endDate: dateStr,
        note: 'Register day = business_date: 08:00 day D through 07:59 morning D+1 (BH0–BH23). Rebuild aggregates after changing the boundary.',
      },
      location,
      hourly,
      worker,
      table,
      guest,
      product,
    }
  } catch (e) {
    console.error('[borkDayBreakdownApi]', e)
    throw createError({ statusCode: 500, statusMessage: String(e) })
  }
})
