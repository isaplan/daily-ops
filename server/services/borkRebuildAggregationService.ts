/**
 * @registry-id: borkRebuildAggregationService
 * @created: 2026-04-09T00:00:00.000Z
 * @last-modified: 2026-04-30T02:00:00.000Z
 * @description: Rebuilds Bork sales aggregations from bork_raw_data using UNIFIED location names by CALENDAR DATE
 * @last-fix: [2026-04-30] Register business day boundary 06:00 → 08:00 (BH0=08:00…BH23=07:59 next morning); re-run rebuild for correct buckets
 *
 * @CRITICAL: Primary bucketing uses calendar order.Date + ticket hour (local register time).
 * Each hourly (and related) document also stores business_date + business_hour so reports can filter by register business day without recomputing.
 * Register business day: 08:00–07:59 next calendar morning → business_hour 0 = 08:00–08:59 same day, 16–23 = 00:00–07:59 next calendar day.
 *
 * @CRITICAL: This service uses bork_unified_location_mapping to resolve locationNames.
 * All aggregation documents MUST have locationName matching unifiedLocationName, NOT raw Bork names.
 * If location names are inconsistent in aggregations, delete all aggregation collections and rebuild.
 *
 * @exports-to:
 * ✓ server/services/borkSyncService.ts
 * ✓ server/api/bork/v2/aggregation.get.ts
 * ✓ pages/daily-ops/sales/day-breakdown.vue => Apply business day logic in query layer
 */

import type { Db, Document } from 'mongodb'

export type RebuildBorkAggResult = {
  byCron: number
  byHour: number
  byTable: number
  byWorker: number
  byGuestAccount: number
  productsMaster: number
}

/**
 * Parse Bork date format (YYYYMMDD) to ISO string
 */
function borkDateToISO(borkDate: number): string {
  const s = String(borkDate).padStart(8, '0')
  const year = s.slice(0, 4)
  const month = s.slice(4, 6)
  const day = s.slice(6, 8)
  return `${year}-${month}-${day}`
}

/**
 * Extract hour from Bork Time field (HH:MM:SS string)
 */
function extractHour(timeStr: string | undefined): number {
  if (!timeStr) return 0
  const match = timeStr.match(/^(\d{1,2}):/)
  return match ? parseInt(match[1], 10) : 0
}

/** ISO YYYY-MM-DD plus whole days (UTC calendar math; Bork times are treated as local wall-clock). */
function addCalendarDaysISO(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Register business day 08:00 (inclusive) through 07:59 next calendar morning.
 * business_hour 0 = 08:00–08:59, … 15 = 23:00–23:59, 16 = 00:00–00:59 next day, … 23 = 07:00–07:59.
 */
function calendarToBusinessDay(
  calendarDateStr: string,
  calendarHour: number
): { businessDate: string; businessHour: number } {
  if (calendarHour >= 8 && calendarHour <= 23) {
    return { businessDate: calendarDateStr, businessHour: calendarHour - 8 }
  }
  return {
    businessDate: addCalendarDaysISO(calendarDateStr, -1),
    businessHour: calendarHour + 16,
  }
}

/**
 * Rebuild all Bork sales aggregations from raw data for a date range
 * @param collectionSuffix Optional suffix for collection names (e.g., '_test' creates bork_sales_by_hour_test)
 */
export async function rebuildBorkSalesAggregation(
  db: Db,
  startDate: string,
  endDate: string,
  collectionSuffix: string = '',
  cronTime: Date = new Date()
): Promise<RebuildBorkAggResult> {
  const result: RebuildBorkAggResult = {
    byCron: 0,
    byHour: 0,
    byTable: 0,
    byWorker: 0,
    byGuestAccount: 0,
    productsMaster: 0,
  }

  // Parse date range
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const startBorkDate = startYear * 10000 + startMonth * 100 + startDay
  const endBorkDate = endYear * 10000 + endMonth * 100 + endDay

  // Load mapping tables for unified IDs
  const locMappings = await db.collection('bork_unified_location_mapping').find({}).toArray()
  const userMappings = await db.collection('bork_unified_user_mapping').find({}).toArray()

  const locMap = new Map(locMappings.map(l => [String(l.borkLocationId), { unifiedId: l.unifiedLocationId, name: l.unifiedLocationName }]))
  const userMap = new Map(userMappings.map(u => [u.borkUserId || u.borkUserName, { unifiedId: u.unifiedUserId, name: u.unifiedUserName }]))

  // Ticket-day sync only — stream one doc at a time (full toArray() OOMs on multi-year backfills)
  const cursor = db
    .collection('bork_raw_data')
    .find({ endpoint: 'bork_daily' })
    .batchSize(32)

  // Aggregate data by cron, hour, table, worker
  const byCronMap = new Map<string, Document>()
  const byHourMap = new Map<string, Document>()
  const byTableMap = new Map<string, Document>()
  const byWorkerMap = new Map<string, Document>()
  const byGuestAccountMap = new Map<string, Document>()
  const productsMasterMap = new Map<string, Document>()

  try {
    for await (const rawDoc of cursor) {
    const borkLocationId = rawDoc.locationId
    const locMapping = locMap.get(String(borkLocationId))
    
    if (!locMapping) {
      console.warn(`No unified location mapping for Bork location ${borkLocationId}`)
      continue
    }

    const unifiedLocationId = locMapping.unifiedId
    const unifiedLocationName = locMapping.name
    const tickets = Array.isArray(rawDoc.rawApiResponse) ? rawDoc.rawApiResponse : [rawDoc.rawApiResponse]

    for (const ticket of tickets) {
      if (!ticket || typeof ticket !== 'object') continue

      const borkWorkerName = ticket.UserName || 'Unknown'
      const userMapping = userMap.get(borkWorkerName) || userMap.get(ticket.UserId)
      const unifiedWorkerId = userMapping?.unifiedId || 'unknown'
      const unifiedWorkerName = userMapping?.name || borkWorkerName

      // Process Orders and Lines
      const orders = Array.isArray(ticket.Orders) ? ticket.Orders : []

      for (const order of orders) {
        if (!order || typeof order !== 'object') continue

        // Check order date against range
        const orderDate = String(order.Date || order.ActualDate || '').padStart(8, '0')
        if (!orderDate || orderDate === '00000000') continue

        const orderBorkDate = parseInt(orderDate, 10)
        if (orderBorkDate < startBorkDate || orderBorkDate > endBorkDate) continue

        const dateStr = borkDateToISO(orderBorkDate)
        
        // Table number is at order level, not ticket level
        // ONLY aggregate orders WITH table numbers into bork_sales_by_table
        // Null/empty = guest accounts - skip from table aggregation
        const tableNumber = String(order.TableNr || '').trim()
        const hasTable = tableNumber.length > 0

        const lines = Array.isArray(order.Lines) ? order.Lines : []

        for (const line of lines) {
          if (!line || typeof line !== 'object') continue

          const price = Number(line.Price || 0)
          const qty = Number(line.Qty || 0)
          const totalPrice = price * qty
          const productName = line.ProductName || 'Unknown'
          const productKey = line.ProductKey || 'unknown'

          // Extract hour from ticket time (not order time)
          const hour = extractHour(ticket.Time as string)
          const { businessDate, businessHour } = calendarToBusinessDay(dateStr, hour)

          // BY CRON: aggregate by unified location + date (ALL orders)
          const cronKey = `${unifiedLocationId}:${dateStr}`
          if (!byCronMap.has(cronKey)) {
            byCronMap.set(cronKey, {
              cronTime,
              locationId: unifiedLocationId,
              locationName: unifiedLocationName,
              date: dateStr,
              total_revenue: 0,
              total_quantity: 0,
              record_count: 0,
            })
          }
          const cronEntry = byCronMap.get(cronKey)!
          cronEntry.total_revenue = (cronEntry.total_revenue as number) + totalPrice
          cronEntry.total_quantity = (cronEntry.total_quantity as number) + qty
          cronEntry.record_count = (cronEntry.record_count as number) + 1

          // BY HOUR: aggregate by unified location + date + hour (ALL orders)
          const hourKey = `${unifiedLocationId}:${dateStr}:${hour}`
          if (!byHourMap.has(hourKey)) {
            byHourMap.set(hourKey, {
              date: dateStr,
              hour,
              business_date: businessDate,
              business_hour: businessHour,
              locationId: unifiedLocationId,
              locationName: unifiedLocationName,
              total_revenue: 0,
              total_quantity: 0,
              record_count: 0,
              products: new Map<string, { productId: string; productName: string; revenue: number; quantity: number }>(),
            })
          }
          const hourEntry = byHourMap.get(hourKey)!
          hourEntry.total_revenue = (hourEntry.total_revenue as number) + totalPrice
          hourEntry.total_quantity = (hourEntry.total_quantity as number) + qty
          hourEntry.record_count = (hourEntry.record_count as number) + 1

          // Track products in hour entry
          if (!hourEntry.products.has(productKey)) {
            hourEntry.products.set(productKey, {
              productId: productKey,
              productName,
              revenue: 0,
              quantity: 0,
            })
          }
          const prod = hourEntry.products.get(productKey)!
          prod.revenue += totalPrice
          prod.quantity += qty

          // BY TABLE: ONLY if order has table number (skip guest accounts)
          if (hasTable) {
            const tableKey = `${unifiedLocationId}:${dateStr}:${hour}:${tableNumber}`
            if (!byTableMap.has(tableKey)) {
              byTableMap.set(tableKey, {
                date: dateStr,
                hour,
                business_date: businessDate,
                business_hour: businessHour,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                tableNumber,
                total_revenue: 0,
                total_quantity: 0,
                products: new Map<string, { productId: string; productName: string; revenue: number; quantity: number }>(),
              })
            }
            const tableEntry = byTableMap.get(tableKey)!
            tableEntry.total_revenue = (tableEntry.total_revenue as number) + totalPrice
            tableEntry.total_quantity = (tableEntry.total_quantity as number) + qty

            if (!tableEntry.products.has(productKey)) {
              tableEntry.products.set(productKey, {
                productId: productKey,
                productName,
                revenue: 0,
                quantity: 0,
              })
            }
            const tableProd = tableEntry.products.get(productKey)!
            tableProd.revenue += totalPrice
            tableProd.quantity += qty
          }

          // BY WORKER: aggregate by unified location + date + hour + worker
          const workerKey = `${unifiedLocationId}:${dateStr}:${hour}:${unifiedWorkerId}`
          if (!byWorkerMap.has(workerKey)) {
            byWorkerMap.set(workerKey, {
              date: dateStr,
              hour,
              business_date: businessDate,
              business_hour: businessHour,
              locationId: unifiedLocationId,
              locationName: unifiedLocationName,
              workerId: unifiedWorkerId,
              workerName: unifiedWorkerName,
              total_revenue: 0,
              total_quantity: 0,
              record_count: 0,
              products: new Map<string, { productId: string; productName: string; revenue: number; quantity: number }>(),
            })
          }
          const workerEntry = byWorkerMap.get(workerKey)!
          workerEntry.total_revenue = (workerEntry.total_revenue as number) + totalPrice
          workerEntry.total_quantity = (workerEntry.total_quantity as number) + qty
          workerEntry.record_count = (workerEntry.record_count as number) + 1

          if (!workerEntry.products.has(productKey)) {
            workerEntry.products.set(productKey, {
              productId: productKey,
              productName,
              revenue: 0,
              quantity: 0,
            })
          }
          const workerProd = workerEntry.products.get(productKey)!
          workerProd.revenue += totalPrice
          workerProd.quantity += qty

          // BY GUEST ACCOUNT: ONLY if order has NO table (guest/on-factuur)
          if (!hasTable) {
            const guestAccountName = ticket.AccountName || 'Unknown Account'
            const guestKey = `${unifiedLocationId}:${dateStr}:${hour}:${guestAccountName}`
            if (!byGuestAccountMap.has(guestKey)) {
              byGuestAccountMap.set(guestKey, {
                date: dateStr,
                hour,
                business_date: businessDate,
                business_hour: businessHour,
                locationId: unifiedLocationId,
                locationName: unifiedLocationName,
                accountName: guestAccountName,
                workerId: unifiedWorkerId,
                workerName: unifiedWorkerName,
                total_revenue: 0,
                total_quantity: 0,
                products: new Map<string, { productId: string; productName: string; revenue: number; quantity: number }>(),
              })
            }
            const guestEntry = byGuestAccountMap.get(guestKey)!
            guestEntry.total_revenue = (guestEntry.total_revenue as number) + totalPrice
            guestEntry.total_quantity = (guestEntry.total_quantity as number) + qty

            if (!guestEntry.products.has(productKey)) {
              guestEntry.products.set(productKey, {
                productId: productKey,
                productName,
                revenue: 0,
                quantity: 0,
              })
            }
            const guestProd = guestEntry.products.get(productKey)!
            guestProd.revenue += totalPrice
            guestProd.quantity += qty
          }

          // PRODUCTS MASTER: track unique products with unified location
          if (!productsMasterMap.has(productKey)) {
            productsMasterMap.set(productKey, {
              productId: productKey,
              productName,
              locationIds: new Set<string>(),
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }
          const prodMaster = productsMasterMap.get(productKey)!
          prodMaster.locationIds.add(String(unifiedLocationId))
          prodMaster.updatedAt = new Date()
        }
      }
    }
    }
  } finally {
    await cursor.close()
  }

  // Convert Maps to arrays and insert into database
  const cronDocs = Array.from(byCronMap.values())
  const hourDocs = Array.from(byHourMap.values()).map((doc) => ({
    ...doc,
    products: Array.from(doc.products.values()),
  }))
  const tableDocs = Array.from(byTableMap.values()).map((doc) => ({
    ...doc,
    products: Array.from(doc.products.values()),
  }))
  const workerDocs = Array.from(byWorkerMap.values()).map((doc) => ({
    ...doc,
    products: Array.from(doc.products.values()),
  }))
  const guestAccountDocs = Array.from(byGuestAccountMap.values()).map((doc) => ({
    ...doc,
    products: Array.from(doc.products.values()),
  }))
  const productDocs = Array.from(productsMasterMap.values()).map((doc) => ({
    ...doc,
    locationIds: Array.from(doc.locationIds),
  }))

  // CLEAR existing aggregations for this date range before rebuilding
  // This prevents duplicates when rebuilding the same date range
  const clearStartDate = borkDateToISO(startBorkDate)
  const clearEndDate = borkDateToISO(endBorkDate)
  
  console.log(`[rebuildBorkSalesAggregation] Clearing existing aggregations for ${clearStartDate} to ${clearEndDate}...`)
  await db.collection(`bork_sales_by_cron${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } })
  await db.collection(`bork_sales_by_hour${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } })
  await db.collection(`bork_sales_by_table${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } })
  await db.collection(`bork_sales_by_worker${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } })
  await db.collection(`bork_sales_by_guest_account${collectionSuffix}`).deleteMany({ date: { $gte: clearStartDate, $lte: clearEndDate } })

  // Insert or upsert documents
  if (cronDocs.length > 0) {
    await db.collection(`bork_sales_by_cron${collectionSuffix}`).insertMany(cronDocs)
    result.byCron = cronDocs.length
  }

  if (hourDocs.length > 0) {
    await db.collection(`bork_sales_by_hour${collectionSuffix}`).insertMany(hourDocs)
    result.byHour = hourDocs.length
  }

  if (tableDocs.length > 0) {
    await db.collection(`bork_sales_by_table${collectionSuffix}`).insertMany(tableDocs)
    result.byTable = tableDocs.length
  }

  if (workerDocs.length > 0) {
    await db.collection(`bork_sales_by_worker${collectionSuffix}`).insertMany(workerDocs)
    result.byWorker = workerDocs.length
  }

  if (guestAccountDocs.length > 0) {
    await db.collection(`bork_sales_by_guest_account${collectionSuffix}`).insertMany(guestAccountDocs)
    result.byGuestAccount = guestAccountDocs.length
  }

  // Upsert products (merge with existing)
  for (const prodDoc of productDocs) {
    await db.collection('bork_products_master').updateOne(
      { productId: prodDoc.productId },
      {
        $set: {
          productId: prodDoc.productId,
          productName: prodDoc.productName,
          updatedAt: prodDoc.updatedAt,
        },
        $addToSet: { locationIds: { $each: prodDoc.locationIds } },
        $setOnInsert: { createdAt: prodDoc.createdAt },
      },
      { upsert: true }
    )
  }
  result.productsMaster = productDocs.length

  return result
}
