/**
 * @registry-id: borkRebuildAggregationService
 * @created: 2026-04-09T00:00:00.000Z
 * @last-modified: 2026-04-13T17:00:00.000Z
 * @description: Rebuilds Bork sales aggregations from bork_raw_data using UNIFIED location names with BUSINESS DAY logic (08:00-08:00)
 * @last-fix: [2026-04-13] Fixed date aggregation: hours 0-7 now correctly belong to previous business day (business day runs 08:00-08:00)
 *
 * @CRITICAL BUSINESS LOGIC:
 * - Business day: 08:00 yesterday → 08:00 today (e.g., Apr 10 08:00 → Apr 11 08:00 = "2026-04-10")
 * - Hours 0-7 (00:00-08:00) belong to the PREVIOUS business day
 * - Hours 8-23 (08:00-23:59) belong to the CURRENT business day
 * - All aggregations use businessDayDate, NOT raw ticket date
 *
 * @CRITICAL: This service uses bork_unified_location_mapping to resolve locationNames.
 * All aggregation documents MUST have locationName matching unifiedLocationName, NOT raw Bork names.
 * If location names are inconsistent in aggregations, delete all aggregation collections and rebuild.
 *
 * @exports-to:
 * ✓ server/services/borkSyncService.ts
 * ✓ server/api/bork/v2/aggregation.get.ts
 * ✓ pages/daily-ops/sales/day-breakdown.vue => Requires unified location names and correct business day dates
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

/**
 * Calculate business day (08:00 to 08:00) for a given ticket date and hour.
 * Hours 00-07 belong to the previous business day.
 * Hours 08-23 belong to the current business day.
 * 
 * Example: 2026-04-11 02:00 → 2026-04-10 (business day: 08:00 Apr 10 → 08:00 Apr 11)
 * Example: 2026-04-11 14:00 → 2026-04-11 (business day: 08:00 Apr 11 → 08:00 Apr 12)
 */
function getBusinessDayDate(dateStr: string, hour: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day, hour, 0, 0)
  
  // If hour is 0-7, this transaction belongs to yesterday's business day
  if (hour < 8) {
    date.setDate(date.getDate() - 1)
  }
  
  return date.toISOString().split('T')[0]
}

/**
 * Rebuild all Bork sales aggregations from raw data for a date range
 */
export async function rebuildBorkSalesAggregation(
  db: Db,
  startDate: string,
  endDate: string,
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
          
          // Calculate business day (08:00-08:00): hours 0-7 belong to previous day
          const businessDayDate = getBusinessDayDate(dateStr, hour)

          // BY CRON: aggregate by unified location + date (ALL orders)
          const cronKey = `${unifiedLocationId}:${businessDayDate}`
          if (!byCronMap.has(cronKey)) {
            byCronMap.set(cronKey, {
              cronTime,
              locationId: unifiedLocationId,
              locationName: unifiedLocationName,
              date: businessDayDate,
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
          const hourKey = `${unifiedLocationId}:${businessDayDate}:${hour}`
          if (!byHourMap.has(hourKey)) {
            byHourMap.set(hourKey, {
              date: businessDayDate,
              hour,
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
            const tableKey = `${unifiedLocationId}:${businessDayDate}:${hour}:${tableNumber}`
            if (!byTableMap.has(tableKey)) {
              byTableMap.set(tableKey, {
                date: businessDayDate,
                hour,
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
          const workerKey = `${unifiedLocationId}:${businessDayDate}:${hour}:${unifiedWorkerId}`
          if (!byWorkerMap.has(workerKey)) {
            byWorkerMap.set(workerKey, {
              date: businessDayDate,
              hour,
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
            const guestKey = `${unifiedLocationId}:${businessDayDate}:${hour}:${guestAccountName}`
            if (!byGuestAccountMap.has(guestKey)) {
              byGuestAccountMap.set(guestKey, {
                date: businessDayDate,
                hour,
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

  // Insert or upsert documents
  if (cronDocs.length > 0) {
    await db.collection('bork_sales_by_cron').insertMany(cronDocs)
    result.byCron = cronDocs.length
  }

  if (hourDocs.length > 0) {
    await db.collection('bork_sales_by_hour').insertMany(hourDocs)
    result.byHour = hourDocs.length
  }

  if (tableDocs.length > 0) {
    await db.collection('bork_sales_by_table').insertMany(tableDocs)
    result.byTable = tableDocs.length
  }

  if (workerDocs.length > 0) {
    await db.collection('bork_sales_by_worker').insertMany(workerDocs)
    result.byWorker = workerDocs.length
  }

  if (guestAccountDocs.length > 0) {
    await db.collection('bork_sales_by_guest_account').insertMany(guestAccountDocs)
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
