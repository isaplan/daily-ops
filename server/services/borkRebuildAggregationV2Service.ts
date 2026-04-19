/**
 * @registry-id: borkRebuildAggregationV2Service
 * @created: 2026-04-14T18:00:00.000Z
 * @last-modified: 2026-04-18T12:00:00.000Z
 * @description: V2 Bork aggregates: register business-day buckets only — bork_sales_hours + bork_business_days (parallel test path; V1 unchanged)
 * @last-fix: [2026-04-18] Documented rebuild-bork-v2-date-range consumer; no logic change
 *
 * @CRITICAL: Same raw scan + line math as V1; keys are business coordinates (06:00–05:59 register day).
 * Does NOT write to bork_sales_by_* — only bork_sales_hours and bork_business_days.
 *
 * @exports-to:
 * ✓ scripts/bork-backfill-weekly-backward.ts (optional BORK_AGG_V2=1)
 * ✓ scripts/rebuild-bork-v2-date-range.ts (BORK_V2_REBUILD_CONFIRM=1; optional BORK_V2_START/BORK_V2_END)
 */

import type { Db, Document } from 'mongodb'

function borkDateToISO(borkDate: number): string {
  const s = String(borkDate).padStart(8, '0')
  const year = s.slice(0, 4)
  const month = s.slice(4, 6)
  const day = s.slice(6, 8)
  return `${year}-${month}-${day}`
}

function extractHour(timeStr: string | undefined): number {
  if (!timeStr) return 0
  const match = timeStr.match(/^(\d{1,2}):/)
  return match ? parseInt(match[1], 10) : 0
}

function addCalendarDaysISO(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function calendarToBusinessDay(
  calendarDateStr: string,
  calendarHour: number
): { businessDate: string; businessHour: number } {
  if (calendarHour >= 6 && calendarHour <= 23) {
    return { businessDate: calendarDateStr, businessHour: calendarHour - 6 }
  }
  return {
    businessDate: addCalendarDaysISO(calendarDateStr, -1),
    businessHour: calendarHour + 18,
  }
}

function isBorkTicketOpenUnsettled(ticket: { ActualDate?: number | string } | null | undefined): boolean {
  if (!ticket || typeof ticket !== 'object') return false
  const ad = ticket.ActualDate
  return ad === 10101 || ad === '10101'
}

export type RebuildBorkAggV2Result = {
  businessDays: number
  salesHours: number
}

/**
 * Rebuild V2 collections from bork_raw_data for order.Date in [startDate, endDate] (calendar).
 * Clears V2 rows whose business_date falls in the implied business-day window (start−1 day .. end inclusive).
 */
export async function rebuildBorkSalesAggregationV2(
  db: Db,
  startDate: string,
  endDate: string,
  collectionSuffix: string = ''
): Promise<RebuildBorkAggV2Result> {
  const result: RebuildBorkAggV2Result = { businessDays: 0, salesHours: 0 }

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const startBorkDate = startYear * 10000 + startMonth * 100 + startDay
  const endBorkDate = endYear * 10000 + endMonth * 100 + endDay

  const locMappings = await db.collection('bork_unified_location_mapping').find({}).toArray()
  const locMap = new Map(
    locMappings.map((l) => [String(l.borkLocationId), { unifiedId: l.unifiedLocationId, name: l.unifiedLocationName }])
  )

  const hoursCollection = `bork_sales_hours${collectionSuffix}`
  const daysCollection = `bork_business_days${collectionSuffix}`

  const byHourMap = new Map<string, Document>()
  const byDayMap = new Map<string, Document>()

  const cursor = db.collection('bork_raw_data').find({ endpoint: 'bork_daily' }).batchSize(32)

  try {
    for await (const rawDoc of cursor) {
      const borkLocationId = rawDoc.locationId
      const locMapping = locMap.get(String(borkLocationId))
      if (!locMapping) continue

      const unifiedLocationId = locMapping.unifiedId
      const unifiedLocationName = locMapping.name
      const tickets = Array.isArray(rawDoc.rawApiResponse) ? rawDoc.rawApiResponse : [rawDoc.rawApiResponse]

      for (const ticket of tickets) {
        if (!ticket || typeof ticket !== 'object') continue
        if (isBorkTicketOpenUnsettled(ticket)) continue
        const calendarHour = extractHour(ticket.Time as string)
        const orders = Array.isArray(ticket.Orders) ? ticket.Orders : []

        for (const order of orders) {
          if (!order || typeof order !== 'object') continue

          const orderDate = String(order.Date || order.ActualDate || '').padStart(8, '0')
          if (!orderDate || orderDate === '00000000') continue

          const orderBorkDate = parseInt(orderDate, 10)
          if (orderBorkDate < startBorkDate || orderBorkDate > endBorkDate) continue

          const isoDate = borkDateToISO(orderBorkDate)
          const { businessDate, businessHour } = calendarToBusinessDay(isoDate, calendarHour)

          const lines = Array.isArray(order.Lines) ? order.Lines : []
          for (const line of lines) {
            if (!line || typeof line !== 'object') continue

            const price = Number(line.Price || 0)
            const qty = Number(line.Qty || 0)
            const totalPrice = price * qty

            const hourKey = `${unifiedLocationId}:${businessDate}:${businessHour}`
            if (!byHourMap.has(hourKey)) {
              byHourMap.set(hourKey, {
                schema_version: 2,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                business_date: businessDate,
                business_hour: businessHour,
                total_revenue: 0,
                total_quantity: 0,
                record_count: 0,
              })
            }
            const he = byHourMap.get(hourKey)!
            he.total_revenue = (he.total_revenue as number) + totalPrice
            he.total_quantity = (he.total_quantity as number) + qty
            he.record_count = (he.record_count as number) + 1

            const dayKey = `${unifiedLocationId}:${businessDate}`
            if (!byDayMap.has(dayKey)) {
              byDayMap.set(dayKey, {
                schema_version: 2,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                business_date: businessDate,
                status: 'aggregated',
                total_revenue: 0,
                total_quantity: 0,
                record_count: 0,
                hour_buckets: 0,
              })
            }
            const de = byDayMap.get(dayKey)!
            de.total_revenue = (de.total_revenue as number) + totalPrice
            de.total_quantity = (de.total_quantity as number) + qty
            de.record_count = (de.record_count as number) + 1
          }
        }
      }
    }
  } finally {
    await cursor.close()
  }

  const clearStartBusiness = addCalendarDaysISO(startDate, -1)
  const clearEndBusiness = endDate

  const hourDocs = Array.from(byHourMap.values())
  const distinctHoursPerDay = new Map<string, Set<number>>()
  for (const d of hourDocs) {
    const k = `${d.locationId}:${d.business_date}`
    if (!distinctHoursPerDay.has(k)) distinctHoursPerDay.set(k, new Set())
    distinctHoursPerDay.get(k)!.add(d.business_hour as number)
  }
  const dayDocs = Array.from(byDayMap.values()).map((d) => {
    const k = `${d.locationId}:${d.business_date}`
    const set = distinctHoursPerDay.get(k)
    return { ...d, hour_buckets: set ? set.size : 0 }
  })

  console.log(
    `[rebuildBorkSalesAggregationV2] Clearing ${hoursCollection} / ${daysCollection} for business_date ${clearStartBusiness}..${clearEndBusiness}...`
  )
  await db.collection(hoursCollection).deleteMany({
    business_date: { $gte: clearStartBusiness, $lte: clearEndBusiness },
  })
  await db.collection(daysCollection).deleteMany({
    business_date: { $gte: clearStartBusiness, $lte: clearEndBusiness },
  })

  if (hourDocs.length > 0) {
    await db.collection(hoursCollection).insertMany(hourDocs as Document[])
    result.salesHours = hourDocs.length
  }
  if (dayDocs.length > 0) {
    await db.collection(daysCollection).insertMany(dayDocs as Document[])
    result.businessDays = dayDocs.length
  }

  return result
}
