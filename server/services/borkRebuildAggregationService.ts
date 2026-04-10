/**
 * @registry-id: borkRebuildAggregationService
 * @created: 2026-04-09T00:00:00.000Z
 * @last-modified: 2026-04-09T00:00:00.000Z
 * @description: Rebuilds Bork sales aggregations from bork_raw_data; creates by-hour, by-table, by-worker, by-cron snapshots
 * @last-fix: [2026-04-09] Initial implementation with focused small-document collections
 *
 * @exports-to:
 * ✓ server/services/borkSyncService.ts
 */

import type { Db, Document } from 'mongodb'

export type RebuildBorkAggResult = {
  byCron: number
  byHour: number
  byTable: number
  byWorker: number
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
    productsMaster: 0,
  }

  // Parse date range
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const startBorkDate = startYear * 10000 + startMonth * 100 + startDay
  const endBorkDate = endYear * 10000 + endMonth * 100 + endDay

  // Fetch raw data for date range
  const rawDocs = await db
    .collection('bork_raw_data')
    .find({
      'rawApiResponse.0.Orders.0.Date': { $gte: startBorkDate, $lte: endBorkDate },
    })
    .toArray()

  if (rawDocs.length === 0) {
    return result
  }

  // Aggregate data by cron, hour, table, worker
  const byCronMap = new Map<string, Document>()
  const byHourMap = new Map<string, Document>()
  const byTableMap = new Map<string, Document>()
  const byWorkerMap = new Map<string, Document>()
  const productsMasterMap = new Map<string, Document>()

  for (const rawDoc of rawDocs) {
    const locationId = rawDoc.locationId
    const tickets = Array.isArray(rawDoc.rawApiResponse) ? rawDoc.rawApiResponse : [rawDoc.rawApiResponse]

    for (const ticket of tickets) {
      if (!ticket || typeof ticket !== 'object') continue

      const ticketDate = String(ticket.ActualDate || ticket.Date || '').padStart(8, '0')
      if (!ticketDate || ticketDate === '00000000') continue

      const dateStr = borkDateToISO(parseInt(ticketDate, 10))
      const hour = extractHour(ticket.Time as string)
      const tableNumber = ticket.TableName || 'Unknown'
      const workerId = ticket.UserKey || ticket.UserId || 'Unknown'
      const workerName = ticket.UserName || 'Unknown'
      const locationName = ticket.CenterName || 'Unknown'

      // Process Orders and Lines
      const orders = Array.isArray(ticket.Orders) ? ticket.Orders : []

      for (const order of orders) {
        if (!order || typeof order !== 'object') continue

        const lines = Array.isArray(order.Lines) ? order.Lines : []

        for (const line of lines) {
          if (!line || typeof line !== 'object') continue

          const price = Number(line.Price || 0)
          const qty = Number(line.Qty || 0)
          const totalPrice = price * qty
          const productName = line.ProductName || 'Unknown'
          const productKey = line.ProductKey || 'unknown'

          // BY CRON: aggregate by location + date
          const cronKey = `${locationId}:${dateStr}`
          if (!byCronMap.has(cronKey)) {
            byCronMap.set(cronKey, {
              cronTime,
              locationId,
              locationName,
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

          // BY HOUR: aggregate by location + date + hour
          const hourKey = `${locationId}:${dateStr}:${hour}`
          if (!byHourMap.has(hourKey)) {
            byHourMap.set(hourKey, {
              date: dateStr,
              hour,
              locationId,
              locationName,
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

          // BY TABLE: aggregate by location + date + hour + table
          const tableKey = `${locationId}:${dateStr}:${hour}:${tableNumber}`
          if (!byTableMap.has(tableKey)) {
            byTableMap.set(tableKey, {
              date: dateStr,
              hour,
              locationId,
              locationName,
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

          // BY WORKER: aggregate by location + date + hour + worker
          const workerKey = `${locationId}:${dateStr}:${hour}:${workerId}`
          if (!byWorkerMap.has(workerKey)) {
            byWorkerMap.set(workerKey, {
              date: dateStr,
              hour,
              locationId,
              locationName,
              workerId,
              workerName,
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

          // PRODUCTS MASTER: track unique products
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
          prodMaster.locationIds.add(String(locationId))
          prodMaster.updatedAt = new Date()
        }
      }
    }
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

  // Upsert products (merge with existing)
  for (const prodDoc of productDocs) {
    await db.collection('bork_products_master').updateOne(
      { productId: prodDoc.productId },
      {
        $set: prodDoc,
        $addToSet: { locationIds: { $each: prodDoc.locationIds } },
      },
      { upsert: true }
    )
  }
  result.productsMaster = productDocs.length

  return result
}
