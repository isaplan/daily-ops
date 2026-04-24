/**
 * @registry-id: borkRebuildAggregationV2Service
 * @created: 2026-04-14T18:00:00.000Z
 * @last-modified: 2026-04-16T12:00:00.000Z
 * @description: V2 Bork aggregates: register business-day buckets — hours, days, tables, workers, guest accounts, product lines (parallel to V1 bork_sales_by_*)
 * @last-fix: [2026-04-16] Added bork_sales_tables/workers/guest_accounts/products + hour product rollups for Sales-V2 UI
 *
 * @CRITICAL: Same raw scan + line math as V1; keys use business_date / business_hour (06:00–05:59 register day).
 * Does NOT write to bork_sales_by_* — uses bork_sales_hours, bork_business_days, bork_sales_tables, bork_sales_workers, bork_sales_guest_accounts, bork_sales_products (+ suffix).
 *
 * @exports-to:
 * ✓ scripts/bork-backfill-weekly-backward.ts (optional BORK_AGG_V2=1)
 * ✓ scripts/rebuild-bork-v2-date-range.ts (BORK_V2_REBUILD_CONFIRM=1; optional BORK_V2_START/BORK_V2_END)
 * ✓ server/api/sales-aggregated-v2.get.ts
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

type ProductRollup = { productId: string; productName: string; revenue: number; quantity: number }

export type RebuildBorkAggV2Result = {
  businessDays: number
  salesHours: number
  tables: number
  workers: number
  guestAccounts: number
  productLines: number
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
  const result: RebuildBorkAggV2Result = {
    businessDays: 0,
    salesHours: 0,
    tables: 0,
    workers: 0,
    guestAccounts: 0,
    productLines: 0,
  }

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const startBorkDate = startYear * 10000 + startMonth * 100 + startDay
  const endBorkDate = endYear * 10000 + endMonth * 100 + endDay

  const locMappings = await db.collection('bork_unified_location_mapping').find({}).toArray()
  const locMap = new Map(
    locMappings.map((l) => [String(l.borkLocationId), { unifiedId: l.unifiedLocationId, name: l.unifiedLocationName }])
  )

  const userMappings = await db.collection('bork_unified_user_mapping').find({}).toArray()
  const userMap = new Map(
    userMappings.map((u) => [u.borkUserId || u.borkUserName, { unifiedId: u.unifiedUserId, name: u.unifiedUserName }])
  )

  const hoursCollection = `bork_sales_hours${collectionSuffix}`
  const daysCollection = `bork_business_days${collectionSuffix}`
  const tablesCollection = `bork_sales_tables${collectionSuffix}`
  const workersCollection = `bork_sales_workers${collectionSuffix}`
  const guestsCollection = `bork_sales_guest_accounts${collectionSuffix}`
  const productsCollection = `bork_sales_products${collectionSuffix}`

  const byHourMap = new Map<string, Document>()
  const byDayMap = new Map<string, Document>()
  const byTableMap = new Map<string, Document>()
  const byWorkerMap = new Map<string, Document>()
  const byGuestMap = new Map<string, Document>()
  const byProductMap = new Map<string, Document>()

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
        const borkWorkerName = (ticket as { UserName?: string }).UserName || 'Unknown'
        const userMapping =
          userMap.get(borkWorkerName) || userMap.get((ticket as { UserId?: string }).UserId)
        const unifiedWorkerId = userMapping?.unifiedId || 'unknown'
        const unifiedWorkerName = userMapping?.name || borkWorkerName

        const orders = Array.isArray(ticket.Orders) ? ticket.Orders : []

        for (const order of orders) {
          if (!order || typeof order !== 'object') continue

          const orderDate = String(order.Date || order.ActualDate || '').padStart(8, '0')
          if (!orderDate || orderDate === '00000000') continue

          const orderBorkDate = parseInt(orderDate, 10)
          if (orderBorkDate < startBorkDate || orderBorkDate > endBorkDate) continue

          const isoDate = borkDateToISO(orderBorkDate)
          const { businessDate, businessHour } = calendarToBusinessDay(isoDate, calendarHour)

          const tableNumber = String((order as { TableNr?: string }).TableNr || '').trim()
          const hasTable = tableNumber.length > 0

          const lines = Array.isArray(order.Lines) ? order.Lines : []
          for (const line of lines) {
            if (!line || typeof line !== 'object') continue

            const price = Number(line.Price || 0)
            const qty = Number(line.Qty || 0)
            const totalPrice = price * qty
            const productName = (line as { ProductName?: string }).ProductName || 'Unknown'
            const productKey = String((line as { ProductKey?: string }).ProductKey || 'unknown')

            const hourKey = `${unifiedLocationId}:${businessDate}:${businessHour}`
            if (!byHourMap.has(hourKey)) {
              byHourMap.set(hourKey, {
                schema_version: 2,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                business_date: businessDate,
                business_hour: businessHour,
                calendar_date: isoDate,
                calendar_hour: calendarHour,
                total_revenue: 0,
                total_quantity: 0,
                record_count: 0,
                products: new Map<string, ProductRollup>(),
              })
            }
            const he = byHourMap.get(hourKey)!
            he.total_revenue = (he.total_revenue as number) + totalPrice
            he.total_quantity = (he.total_quantity as number) + qty
            he.record_count = (he.record_count as number) + 1

            const pmap = he.products as Map<string, ProductRollup>
            if (!pmap.has(productKey)) {
              pmap.set(productKey, { productId: productKey, productName, revenue: 0, quantity: 0 })
            }
            const hp = pmap.get(productKey)!
            hp.revenue += totalPrice
            hp.quantity += qty

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

            const productAggKey = `${unifiedLocationId}:${businessDate}:${productKey}:${price}`
            if (!byProductMap.has(productAggKey)) {
              byProductMap.set(productAggKey, {
                schema_version: 2,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                business_date: businessDate,
                productId: productKey,
                productName,
                unit_price: price,
                total_revenue: 0,
                total_quantity: 0,
                record_count: 0,
              })
            }
            const pe = byProductMap.get(productAggKey)!
            pe.total_revenue = (pe.total_revenue as number) + totalPrice
            pe.total_quantity = (pe.total_quantity as number) + qty
            pe.record_count = (pe.record_count as number) + 1

            if (hasTable) {
              const tableKey = `${unifiedLocationId}:${businessDate}:${businessHour}:${tableNumber}`
              if (!byTableMap.has(tableKey)) {
                byTableMap.set(tableKey, {
                  schema_version: 2,
                  date: isoDate,
                  hour: calendarHour,
                  business_date: businessDate,
                  business_hour: businessHour,
                  locationId: unifiedLocationId,
                  locationName: unifiedLocationName,
                  tableNumber,
                  total_revenue: 0,
                  total_quantity: 0,
                  record_count: 0,
                  products: new Map<string, ProductRollup>(),
                })
              }
              const te = byTableMap.get(tableKey)!
              te.total_revenue = (te.total_revenue as number) + totalPrice
              te.total_quantity = (te.total_quantity as number) + qty
              te.record_count = (te.record_count as number) + 1
              const tm = te.products as Map<string, ProductRollup>
              if (!tm.has(productKey)) {
                tm.set(productKey, { productId: productKey, productName, revenue: 0, quantity: 0 })
              }
              const tp = tm.get(productKey)!
              tp.revenue += totalPrice
              tp.quantity += qty
            }

            const workerKey = `${unifiedLocationId}:${businessDate}:${businessHour}:${unifiedWorkerId}`
            if (!byWorkerMap.has(workerKey)) {
              byWorkerMap.set(workerKey, {
                schema_version: 2,
                date: isoDate,
                hour: calendarHour,
                business_date: businessDate,
                business_hour: businessHour,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                workerId: unifiedWorkerId,
                workerName: unifiedWorkerName,
                total_revenue: 0,
                total_quantity: 0,
                record_count: 0,
                products: new Map<string, ProductRollup>(),
              })
            }
            const we = byWorkerMap.get(workerKey)!
            we.total_revenue = (we.total_revenue as number) + totalPrice
            we.total_quantity = (we.total_quantity as number) + qty
            we.record_count = (we.record_count as number) + 1
            const wm = we.products as Map<string, ProductRollup>
            if (!wm.has(productKey)) {
              wm.set(productKey, { productId: productKey, productName, revenue: 0, quantity: 0 })
            }
            const wp = wm.get(productKey)!
            wp.revenue += totalPrice
            wp.quantity += qty

            if (!hasTable) {
              const guestAccountName = (ticket as { AccountName?: string }).AccountName || 'Unknown Account'
              const guestKey = `${unifiedLocationId}:${businessDate}:${businessHour}:${guestAccountName}`
              if (!byGuestMap.has(guestKey)) {
                byGuestMap.set(guestKey, {
                  schema_version: 2,
                  date: isoDate,
                  hour: calendarHour,
                  business_date: businessDate,
                  business_hour: businessHour,
                  locationId: unifiedLocationId,
                  locationName: unifiedLocationName,
                  accountName: guestAccountName,
                  workerId: unifiedWorkerId,
                  workerName: unifiedWorkerName,
                  total_revenue: 0,
                  total_quantity: 0,
                  record_count: 0,
                  products: new Map<string, ProductRollup>(),
                })
              }
              const ge = byGuestMap.get(guestKey)!
              ge.total_revenue = (ge.total_revenue as number) + totalPrice
              ge.total_quantity = (ge.total_quantity as number) + qty
              ge.record_count = (ge.record_count as number) + 1
              const gm = ge.products as Map<string, ProductRollup>
              if (!gm.has(productKey)) {
                gm.set(productKey, { productId: productKey, productName, revenue: 0, quantity: 0 })
              }
              const gp = gm.get(productKey)!
              gp.revenue += totalPrice
              gp.quantity += qty
            }
          }
        }
      }
    }
  } finally {
    await cursor.close()
  }

  const clearStartBusiness = addCalendarDaysISO(startDate, -1)
  const clearEndBusiness = endDate

  const hourDocs = Array.from(byHourMap.values()).map((doc) => ({
    ...doc,
    products: Array.from((doc.products as Map<string, ProductRollup>).values()),
  }))
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

  const tableDocs = Array.from(byTableMap.values()).map((doc) => ({
    ...doc,
    products: Array.from((doc.products as Map<string, ProductRollup>).values()),
  }))
  const workerDocs = Array.from(byWorkerMap.values()).map((doc) => ({
    ...doc,
    products: Array.from((doc.products as Map<string, ProductRollup>).values()),
  }))
  const guestDocs = Array.from(byGuestMap.values()).map((doc) => ({
    ...doc,
    products: Array.from((doc.products as Map<string, ProductRollup>).values()),
  }))
  const productDocs = Array.from(byProductMap.values())

  const clearFilter = { business_date: { $gte: clearStartBusiness, $lte: clearEndBusiness } }

  console.log(
    `[rebuildBorkSalesAggregationV2] Clearing V2 collections for business_date ${clearStartBusiness}..${clearEndBusiness}...`
  )
  await Promise.all([
    db.collection(hoursCollection).deleteMany(clearFilter),
    db.collection(daysCollection).deleteMany(clearFilter),
    db.collection(tablesCollection).deleteMany(clearFilter),
    db.collection(workersCollection).deleteMany(clearFilter),
    db.collection(guestsCollection).deleteMany(clearFilter),
    db.collection(productsCollection).deleteMany(clearFilter),
  ])

  if (hourDocs.length > 0) {
    await db.collection(hoursCollection).insertMany(hourDocs as Document[])
    result.salesHours = hourDocs.length
  }
  if (dayDocs.length > 0) {
    await db.collection(daysCollection).insertMany(dayDocs as Document[])
    result.businessDays = dayDocs.length
  }
  if (tableDocs.length > 0) {
    await db.collection(tablesCollection).insertMany(tableDocs as Document[])
    result.tables = tableDocs.length
  }
  if (workerDocs.length > 0) {
    await db.collection(workersCollection).insertMany(workerDocs as Document[])
    result.workers = workerDocs.length
  }
  if (guestDocs.length > 0) {
    await db.collection(guestsCollection).insertMany(guestDocs as Document[])
    result.guestAccounts = guestDocs.length
  }
  if (productDocs.length > 0) {
    await db.collection(productsCollection).insertMany(productDocs as Document[])
    result.productLines = productDocs.length
  }

  return result
}
