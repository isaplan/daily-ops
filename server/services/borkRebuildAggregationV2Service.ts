/**
 * @registry-id: borkRebuildAggregationV2Service
 * @created: 2026-04-14T18:00:00.000Z
 * @last-modified: 2026-06-06T00:34:00.000Z
 * @description: V2 Bork aggregates — writes bork_business_days, bork_sales_by_day, bork_sales_by_hour, bork_sales_by_table, bork_sales_by_worker, bork_sales_by_guest_account, bork_sales_by_product (+ version suffix). Every revenue rollup now emits total_revenue (inc VAT, back-compat), total_revenue_ex_vat, total_revenue_inc_vat, total_vat extracted from raw line TotalEx/TotalInc.
 * @last-fix: [2026-06-06] Add includeOpenTickets param: for today (realtime), include open/unsettled tickets; for historical (yesterday+), skip as before.
 *   Prior: [2026-06-02] Order-time worker rollups credit order.UserName (not ticket closer).
 *
 * @CRITICAL: Line revenue uses Lines[].TotalEx + TotalInc (live data confirmed); paymode totals use Order.Paymodes[].Total (tender amounts, no VAT split).
 *
 * @architecture:
 *   - One pass over bork_raw_data rebuilds all 7 collections.
 *   - VAT extraction delegated to server/utils/borkVatCalculation.ts (single source of truth).
 *   - Business day = 08:00 Amsterdam → 07:59:59 next ISO day (see calendarToBusinessDay). Client reads use ADR-010 SSOT.
 *
 * @adr-ref: ADR-010
 *
 * @exports-to:
 * ✓ scripts/bork-backfill-weekly-backward.ts
 * ✓ scripts/rebuild-bork-v2-date-range.ts
 * ✓ scripts/bork-full-raw-backfill.ts
 * ✓ scripts/bork-last-7-days-test.ts
 * ✓ scripts/backfill-bork-vat-fields.ts (Phase 0 backfill)
 * ✓ server/services/borkSyncService.ts
 * ✓ server/api/sales-aggregated.get.ts (read paths via version suffix)
 * ✓ server/utils/borkV2RebuildSuffix.ts (rebuild script write suffix)
 */

import type { Db, Document } from 'mongodb'
import { extractLineRevenue, resetBorkVatDebugSampler } from '../utils/borkVatCalculation'

function borkDateToISO(borkDate: number): string {
  const s = String(borkDate).padStart(8, '0')
  const year = s.slice(0, 4)
  const month = s.slice(4, 6)
  const day = s.slice(6, 8)
  return `${year}-${month}-${day}`
}

function parseHour(timeStr: string | undefined): number | null {
  if (!timeStr) return null
  const match = timeStr.match(/^(\d{1,2}):/)
  if (!match) return null
  const rawHour = match[1]
  if (rawHour == null) return null
  const hour = parseInt(rawHour, 10)
  return hour >= 0 && hour <= 23 ? hour : null
}

function extractHour(timeStr: string | undefined): number {
  return parseHour(timeStr) ?? 0
}

function addCalendarDaysISO(dateStr: string, deltaDays: number): string {
  const [y = 0, m = 1, d = 1] = dateStr.split('-').map(Number)
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
  if (calendarHour >= 8 && calendarHour <= 23) {
    return { businessDate: calendarDateStr, businessHour: calendarHour - 8 }
  }
  return {
    businessDate: addCalendarDaysISO(calendarDateStr, -1),
    businessHour: calendarHour + 16,
  }
}

function isBorkTicketOpenUnsettled(ticket: { ActualDate?: number | string } | null | undefined): boolean {
  if (!ticket || typeof ticket !== 'object') return false
  const ad = ticket.ActualDate
  return ad === 10101 || ad === '10101'
}

type ProductRollup = {
  productId: string
  productName: string
  revenue: number
  revenue_ex_vat: number
  revenue_inc_vat: number
  vat: number
  quantity: number
}

type WorkerDayRollup = {
  workerId: string
  workerName: string
  total_revenue: number
  total_revenue_ex_vat: number
  total_revenue_inc_vat: number
  total_vat: number
  total_quantity: number
  record_count: number
}

type GuestDayRollup = {
  accountName: string
  total_revenue: number
  total_revenue_ex_vat: number
  total_revenue_inc_vat: number
  total_vat: number
  total_quantity: number
}

/** Paymodes are tender amounts (customer payment); no VAT split applies. */
type PaymodeDayRollup = {
  paymodeName: string
  groupName: string
  total_revenue: number
}

type DayRollupInternal = {
  schema_version: number
  locationId: unknown
  locationName: string
  business_date: string
  status: string
  total_revenue: number
  total_revenue_ex_vat: number
  total_revenue_inc_vat: number
  total_vat: number
  total_quantity: number
  record_count: number
  paymode_total: number
  products: Map<string, ProductRollup>
  workers: Map<string, WorkerDayRollup>
  guests: Map<string, GuestDayRollup>
  paymodes: Map<string, PaymodeDayRollup>
}

export type RebuildBorkAggV2Result = {
  businessDays: number
  salesByDay: number
  salesHours: number
  orderSalesHours: number
  tables: number
  workers: number
  orderWorkers: number
  guestAccounts: number
  productLines: number
}

function sortByRevenueDesc<T extends { total_revenue?: number; revenue?: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (b.total_revenue ?? b.revenue ?? 0) - (a.total_revenue ?? a.revenue ?? 0))
}

/**
 * Rebuild V2 collections from bork_raw_data for order.Date in [startDate, endDate] (calendar).
 * Clears V2 rows whose business_date falls in the implied business-day window (start−1 day .. end inclusive).
 */
export async function rebuildBorkSalesAggregationV2(
  db: Db,
  startDate: string,
  endDate: string,
  collectionSuffix: string = '',
  includeOpenTickets: boolean = false
): Promise<RebuildBorkAggV2Result> {
  const result: RebuildBorkAggV2Result = {
    businessDays: 0,
    salesByDay: 0,
    salesHours: 0,
    orderSalesHours: 0,
    tables: 0,
    workers: 0,
    orderWorkers: 0,
    guestAccounts: 0,
    productLines: 0,
  }

  const [startYear = 0, startMonth = 1, startDay = 1] = startDate.split('-').map(Number)
  const [endYear = 0, endMonth = 1, endDay = 1] = endDate.split('-').map(Number)
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

  const hoursCollection = `bork_sales_by_hour${collectionSuffix}`
  const orderHoursCollection = `bork_sales_by_order_hour${collectionSuffix}`
  const daysCollection = `bork_business_days${collectionSuffix}`
  const salesByDayCollection = `bork_sales_by_day${collectionSuffix}`
  const tablesCollection = `bork_sales_by_table${collectionSuffix}`
  const workersCollection = `bork_sales_by_worker${collectionSuffix}`
  const orderWorkersCollection = `bork_sales_by_order_worker${collectionSuffix}`
  const guestsCollection = `bork_sales_by_guest_account${collectionSuffix}`
  const productsCollection = `bork_sales_by_product${collectionSuffix}`

  const byHourMap = new Map<string, Document>()
  const byOrderHourMap = new Map<string, Document>()
  const dayRollupMap = new Map<string, DayRollupInternal>()
  const byTableMap = new Map<string, Document>()
  const byWorkerMap = new Map<string, Document>()
  const byOrderWorkerMap = new Map<string, Document>()
  const byGuestMap = new Map<string, Document>()
  const byProductMap = new Map<string, Document>()

  const cursor = db.collection('bork_raw_data').find({ endpoint: 'bork_daily' }).batchSize(32)

  const ensureDayRollup = (
    dayKey: string,
    unifiedLocationId: unknown,
    unifiedLocationName: string,
    businessDate: string
  ): DayRollupInternal => {
    if (!dayRollupMap.has(dayKey)) {
      dayRollupMap.set(dayKey, {
        schema_version: 2,
        locationId: unifiedLocationId,
        locationName: unifiedLocationName,
        business_date: businessDate,
        status: 'aggregated',
        total_revenue: 0,
        total_revenue_ex_vat: 0,
        total_revenue_inc_vat: 0,
        total_vat: 0,
        total_quantity: 0,
        record_count: 0,
        paymode_total: 0,
        products: new Map<string, ProductRollup>(),
        workers: new Map<string, WorkerDayRollup>(),
        guests: new Map<string, GuestDayRollup>(),
        paymodes: new Map<string, PaymodeDayRollup>(),
      })
    }
    return dayRollupMap.get(dayKey)!
  }

  // Fresh debug sampler per rebuild invocation (gated by DEBUG=bork:vat)
  resetBorkVatDebugSampler()

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
        
        // Skip open/unsettled tickets UNLESS: includeOpenTickets=true
        // Even when including open tickets, we only include those from today (endDate)
        const isOpen = isBorkTicketOpenUnsettled(ticket)
        if (isOpen && !includeOpenTickets) continue
        
        const calendarHour = extractHour(ticket.Time as string)
        const borkWorkerName = (ticket as { UserName?: string }).UserName || 'Unknown'
        const userMapping =
          userMap.get(borkWorkerName) || userMap.get((ticket as { UserId?: string }).UserId)
        const unifiedWorkerId = String(userMapping?.unifiedId || 'unknown')
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
          const orderCalendarHour = parseHour((order as { Time?: string }).Time)
          const orderBusiness =
            orderCalendarHour == null ? null : calendarToBusinessDay(isoDate, orderCalendarHour)
          const borkOrderWorkerName =
            String((order as { UserName?: string }).UserName ?? '').trim() || borkWorkerName
          const orderUserMapping =
            userMap.get(borkOrderWorkerName) ||
            userMap.get(String((order as { UserId?: string }).UserId ?? ''))
          const orderUnifiedWorkerId = String(
            orderUserMapping?.unifiedId ??
              (borkOrderWorkerName === borkWorkerName ? unifiedWorkerId : 'unknown'),
          )
          const orderUnifiedWorkerName =
            orderUserMapping?.name ??
            (borkOrderWorkerName === borkWorkerName ? unifiedWorkerName : borkOrderWorkerName)
          const dayKey = `${unifiedLocationId}:${businessDate}`

          const tableNumber = String((order as { TableNr?: string }).TableNr || '').trim()
          const hasTable = tableNumber.length > 0

          const lines = Array.isArray(order.Lines) ? order.Lines : []
          for (const line of lines) {
            if (!line || typeof line !== 'object') continue

            const { ex, inc, vat, qty } = extractLineRevenue(line)
            const price = Number((line as { Price?: number }).Price ?? 0)
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
                total_revenue_ex_vat: 0,
                total_revenue_inc_vat: 0,
                total_vat: 0,
                total_quantity: 0,
                record_count: 0,
                products: new Map<string, ProductRollup>(),
              })
            }
            const he = byHourMap.get(hourKey)!
            he.total_revenue = (he.total_revenue as number) + inc
            he.total_revenue_ex_vat = (he.total_revenue_ex_vat as number) + ex
            he.total_revenue_inc_vat = (he.total_revenue_inc_vat as number) + inc
            he.total_vat = (he.total_vat as number) + vat
            he.total_quantity = (he.total_quantity as number) + qty
            he.record_count = (he.record_count as number) + 1

            const pmap = he.products as Map<string, ProductRollup>
            if (!pmap.has(productKey)) {
              pmap.set(productKey, { productId: productKey, productName, revenue: 0, revenue_ex_vat: 0, revenue_inc_vat: 0, vat: 0, quantity: 0 })
            }
            const hp = pmap.get(productKey)!
            hp.revenue += inc
            hp.revenue_ex_vat += ex
            hp.revenue_inc_vat += inc
            hp.vat += vat
            hp.quantity += qty

            if (orderBusiness) {
              const orderHourKey = `${unifiedLocationId}:${orderBusiness.businessDate}:${orderBusiness.businessHour}`
              if (!byOrderHourMap.has(orderHourKey)) {
                byOrderHourMap.set(orderHourKey, {
                  schema_version: 2,
                  time_basis: 'order',
                  locationId: unifiedLocationId,
                  locationName: unifiedLocationName,
                  business_date: orderBusiness.businessDate,
                  business_hour: orderBusiness.businessHour,
                  calendar_date: isoDate,
                  calendar_hour: orderCalendarHour,
                  total_revenue: 0,
                  total_revenue_ex_vat: 0,
                  total_revenue_inc_vat: 0,
                  total_vat: 0,
                  total_quantity: 0,
                  record_count: 0,
                  products: new Map<string, ProductRollup>(),
                })
              }
              const oe = byOrderHourMap.get(orderHourKey)!
              oe.total_revenue = (oe.total_revenue as number) + inc
              oe.total_revenue_ex_vat = (oe.total_revenue_ex_vat as number) + ex
              oe.total_revenue_inc_vat = (oe.total_revenue_inc_vat as number) + inc
              oe.total_vat = (oe.total_vat as number) + vat
              oe.total_quantity = (oe.total_quantity as number) + qty
              oe.record_count = (oe.record_count as number) + 1

              const opmap = oe.products as Map<string, ProductRollup>
              if (!opmap.has(productKey)) {
                opmap.set(productKey, { productId: productKey, productName, revenue: 0, revenue_ex_vat: 0, revenue_inc_vat: 0, vat: 0, quantity: 0 })
              }
              const op = opmap.get(productKey)!
              op.revenue += inc
              op.revenue_ex_vat += ex
              op.revenue_inc_vat += inc
              op.vat += vat
              op.quantity += qty

              const orderWorkerKey = `${unifiedLocationId}:${orderBusiness.businessDate}:${orderBusiness.businessHour}:${orderUnifiedWorkerId}`
              if (!byOrderWorkerMap.has(orderWorkerKey)) {
                byOrderWorkerMap.set(orderWorkerKey, {
                  schema_version: 2,
                  time_basis: 'order',
                  date: isoDate,
                  hour: orderCalendarHour,
                  business_date: orderBusiness.businessDate,
                  business_hour: orderBusiness.businessHour,
                  calendar_date: isoDate,
                  calendar_hour: orderCalendarHour,
                  locationId: unifiedLocationId,
                  locationName: unifiedLocationName,
                  workerId: orderUnifiedWorkerId,
                  workerName: orderUnifiedWorkerName,
                  total_revenue: 0,
                  total_revenue_ex_vat: 0,
                  total_revenue_inc_vat: 0,
                  total_vat: 0,
                  total_quantity: 0,
                  record_count: 0,
                  products: new Map<string, ProductRollup>(),
                })
              }
              const owe = byOrderWorkerMap.get(orderWorkerKey)!
              owe.total_revenue = (owe.total_revenue as number) + inc
              owe.total_revenue_ex_vat = (owe.total_revenue_ex_vat as number) + ex
              owe.total_revenue_inc_vat = (owe.total_revenue_inc_vat as number) + inc
              owe.total_vat = (owe.total_vat as number) + vat
              owe.total_quantity = (owe.total_quantity as number) + qty
              owe.record_count = (owe.record_count as number) + 1
              const owm = owe.products as Map<string, ProductRollup>
              if (!owm.has(productKey)) {
                owm.set(productKey, { productId: productKey, productName, revenue: 0, revenue_ex_vat: 0, revenue_inc_vat: 0, vat: 0, quantity: 0 })
              }
              const owp = owm.get(productKey)!
              owp.revenue += inc
              owp.revenue_ex_vat += ex
              owp.revenue_inc_vat += inc
              owp.vat += vat
              owp.quantity += qty
            }

            const dr = ensureDayRollup(dayKey, unifiedLocationId, unifiedLocationName, businessDate)
            dr.total_revenue += inc
            dr.total_revenue_ex_vat += ex
            dr.total_revenue_inc_vat += inc
            dr.total_vat += vat
            dr.total_quantity += qty
            dr.record_count += 1

            if (!dr.products.has(productKey)) {
              dr.products.set(productKey, { productId: productKey, productName, revenue: 0, revenue_ex_vat: 0, revenue_inc_vat: 0, vat: 0, quantity: 0 })
            }
            const dp = dr.products.get(productKey)!
            dp.revenue += inc
            dp.revenue_ex_vat += ex
            dp.revenue_inc_vat += inc
            dp.vat += vat
            dp.quantity += qty

            if (!dr.workers.has(unifiedWorkerId)) {
              dr.workers.set(unifiedWorkerId, {
                workerId: unifiedWorkerId,
                workerName: unifiedWorkerName,
                total_revenue: 0,
                total_revenue_ex_vat: 0,
                total_revenue_inc_vat: 0,
                total_vat: 0,
                total_quantity: 0,
                record_count: 0,
              })
            }
            const dw = dr.workers.get(unifiedWorkerId)!
            dw.total_revenue += inc
            dw.total_revenue_ex_vat += ex
            dw.total_revenue_inc_vat += inc
            dw.total_vat += vat
            dw.total_quantity += qty
            dw.record_count += 1

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
                total_revenue_ex_vat: 0,
                total_revenue_inc_vat: 0,
                total_vat: 0,
                total_quantity: 0,
                record_count: 0,
              })
            }
            const pe = byProductMap.get(productAggKey)!
            pe.total_revenue = (pe.total_revenue as number) + inc
            pe.total_revenue_ex_vat = (pe.total_revenue_ex_vat as number) + ex
            pe.total_revenue_inc_vat = (pe.total_revenue_inc_vat as number) + inc
            pe.total_vat = (pe.total_vat as number) + vat
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
                  total_revenue_ex_vat: 0,
                  total_revenue_inc_vat: 0,
                  total_vat: 0,
                  total_quantity: 0,
                  record_count: 0,
                  products: new Map<string, ProductRollup>(),
                })
              }
              const te = byTableMap.get(tableKey)!
              te.total_revenue = (te.total_revenue as number) + inc
              te.total_revenue_ex_vat = (te.total_revenue_ex_vat as number) + ex
              te.total_revenue_inc_vat = (te.total_revenue_inc_vat as number) + inc
              te.total_vat = (te.total_vat as number) + vat
              te.total_quantity = (te.total_quantity as number) + qty
              te.record_count = (te.record_count as number) + 1
              const tm = te.products as Map<string, ProductRollup>
              if (!tm.has(productKey)) {
                tm.set(productKey, { productId: productKey, productName, revenue: 0, revenue_ex_vat: 0, revenue_inc_vat: 0, vat: 0, quantity: 0 })
              }
              const tp = tm.get(productKey)!
              tp.revenue += inc
              tp.revenue_ex_vat += ex
              tp.revenue_inc_vat += inc
              tp.vat += vat
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
                total_revenue_ex_vat: 0,
                total_revenue_inc_vat: 0,
                total_vat: 0,
                total_quantity: 0,
                record_count: 0,
                products: new Map<string, ProductRollup>(),
              })
            }
            const we = byWorkerMap.get(workerKey)!
            we.total_revenue = (we.total_revenue as number) + inc
            we.total_revenue_ex_vat = (we.total_revenue_ex_vat as number) + ex
            we.total_revenue_inc_vat = (we.total_revenue_inc_vat as number) + inc
            we.total_vat = (we.total_vat as number) + vat
            we.total_quantity = (we.total_quantity as number) + qty
            we.record_count = (we.record_count as number) + 1
            const wm = we.products as Map<string, ProductRollup>
            if (!wm.has(productKey)) {
              wm.set(productKey, { productId: productKey, productName, revenue: 0, revenue_ex_vat: 0, revenue_inc_vat: 0, vat: 0, quantity: 0 })
            }
            const wp = wm.get(productKey)!
            wp.revenue += inc
            wp.revenue_ex_vat += ex
            wp.revenue_inc_vat += inc
            wp.vat += vat
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
                  total_revenue_ex_vat: 0,
                  total_revenue_inc_vat: 0,
                  total_vat: 0,
                  total_quantity: 0,
                  record_count: 0,
                  products: new Map<string, ProductRollup>(),
                })
              }
              const ge = byGuestMap.get(guestKey)!
              ge.total_revenue = (ge.total_revenue as number) + inc
              ge.total_revenue_ex_vat = (ge.total_revenue_ex_vat as number) + ex
              ge.total_revenue_inc_vat = (ge.total_revenue_inc_vat as number) + inc
              ge.total_vat = (ge.total_vat as number) + vat
              ge.total_quantity = (ge.total_quantity as number) + qty
              ge.record_count = (ge.record_count as number) + 1
              const gm = ge.products as Map<string, ProductRollup>
              if (!gm.has(productKey)) {
                gm.set(productKey, { productId: productKey, productName, revenue: 0, revenue_ex_vat: 0, revenue_inc_vat: 0, vat: 0, quantity: 0 })
              }
              const gp = gm.get(productKey)!
              gp.revenue += inc
              gp.revenue_ex_vat += ex
              gp.revenue_inc_vat += inc
              gp.vat += vat
              gp.quantity += qty

              if (!dr.guests.has(guestAccountName)) {
                dr.guests.set(guestAccountName, {
                  accountName: guestAccountName,
                  total_revenue: 0,
                  total_revenue_ex_vat: 0,
                  total_revenue_inc_vat: 0,
                  total_vat: 0,
                  total_quantity: 0,
                })
              }
              const dg = dr.guests.get(guestAccountName)!
              dg.total_revenue += inc
              dg.total_revenue_ex_vat += ex
              dg.total_revenue_inc_vat += inc
              dg.total_vat += vat
              dg.total_quantity += qty
            }
          }

          const paymodes = Array.isArray((order as { Paymodes?: unknown[] }).Paymodes)
            ? (order as { Paymodes: unknown[] }).Paymodes
            : []
          for (const pm of paymodes) {
            if (!pm || typeof pm !== 'object') continue
            const p = pm as { Total?: number; Price?: number; PaymodeName?: string; GroupName?: string }
            const amt = Number(p.Total ?? p.Price ?? 0)
            if (!Number.isFinite(amt) || amt === 0) continue

            const paymodeName = String(p.PaymodeName || 'Unknown')
            const groupName = String(p.GroupName || '')
            const payKey = `${paymodeName}\t${groupName}`

            const drPay = ensureDayRollup(dayKey, unifiedLocationId, unifiedLocationName, businessDate)
            drPay.paymode_total += amt

            if (!drPay.paymodes.has(payKey)) {
              drPay.paymodes.set(payKey, { paymodeName, groupName, total_revenue: 0 })
            }
            const pmR = drPay.paymodes.get(payKey)!
            pmR.total_revenue += amt
          }
        }
      }
    }
  } finally {
    await cursor.close()
  }

  const clearStartBusiness = addCalendarDaysISO(startDate, -1)
  const clearEndBusiness = endDate

  const hourDocs: Document[] = Array.from(byHourMap.values()).map((doc) => ({
    ...doc,
    products: Array.from((doc.products as Map<string, ProductRollup>).values()),
  }))
  const orderHourDocs: Document[] = Array.from(byOrderHourMap.values()).map((doc) => ({
    ...doc,
    products: Array.from((doc.products as Map<string, ProductRollup>).values()),
  }))
  const distinctHoursPerDay = new Map<string, Set<number>>()
  for (const d of hourDocs) {
    const k = `${d.locationId}:${d.business_date}`
    if (!distinctHoursPerDay.has(k)) distinctHoursPerDay.set(k, new Set())
    distinctHoursPerDay.get(k)!.add(d.business_hour as number)
  }

  const slimDayDocs: Document[] = []
  const salesByDayDocs: Document[] = []

  for (const dr of dayRollupMap.values()) {
    const k = `${dr.locationId}:${dr.business_date}`
    const set = distinctHoursPerDay.get(k)
    const hour_buckets = set ? set.size : 0

    slimDayDocs.push({
      schema_version: 2,
      locationId: dr.locationId,
      locationName: dr.locationName,
      business_date: dr.business_date,
      status: dr.status,
      total_revenue: dr.total_revenue,
      total_revenue_ex_vat: dr.total_revenue_ex_vat,
      total_revenue_inc_vat: dr.total_revenue_inc_vat,
      total_vat: dr.total_vat,
      total_quantity: dr.total_quantity,
      record_count: dr.record_count,
      hour_buckets,
    })

    salesByDayDocs.push({
      schema_version: 2,
      locationId: dr.locationId,
      locationName: dr.locationName,
      business_date: dr.business_date,
      status: dr.status,
      total_revenue: dr.total_revenue,
      total_revenue_ex_vat: dr.total_revenue_ex_vat,
      total_revenue_inc_vat: dr.total_revenue_inc_vat,
      total_vat: dr.total_vat,
      total_quantity: dr.total_quantity,
      record_count: dr.record_count,
      hour_buckets,
      paymode_total: dr.paymode_total,
      products_day: sortByRevenueDesc(Array.from(dr.products.values())),
      workers_day: sortByRevenueDesc(Array.from(dr.workers.values())),
      guest_accounts_day: sortByRevenueDesc(Array.from(dr.guests.values())),
      paymodes_day: sortByRevenueDesc(Array.from(dr.paymodes.values())),
    })
  }

  const tableDocs = Array.from(byTableMap.values()).map((doc) => ({
    ...doc,
    products: Array.from((doc.products as Map<string, ProductRollup>).values()),
  }))
  const workerDocs = Array.from(byWorkerMap.values()).map((doc) => ({
    ...doc,
    products: Array.from((doc.products as Map<string, ProductRollup>).values()),
  }))
  const orderWorkerDocs = Array.from(byOrderWorkerMap.values()).map((doc) => ({
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
    db.collection(orderHoursCollection).deleteMany(clearFilter),
    db.collection(daysCollection).deleteMany(clearFilter),
    db.collection(salesByDayCollection).deleteMany(clearFilter),
    db.collection(tablesCollection).deleteMany(clearFilter),
    db.collection(workersCollection).deleteMany(clearFilter),
    db.collection(orderWorkersCollection).deleteMany(clearFilter),
    db.collection(guestsCollection).deleteMany(clearFilter),
    db.collection(productsCollection).deleteMany(clearFilter),
  ])

  if (hourDocs.length > 0) {
    await db.collection(hoursCollection).insertMany(hourDocs as Document[])
    result.salesHours = hourDocs.length
  }
  if (orderHourDocs.length > 0) {
    await db.collection(orderHoursCollection).insertMany(orderHourDocs as Document[])
    result.orderSalesHours = orderHourDocs.length
  }
  if (slimDayDocs.length > 0) {
    await db.collection(daysCollection).insertMany(slimDayDocs)
    result.businessDays = slimDayDocs.length
  }
  if (salesByDayDocs.length > 0) {
    await db.collection(salesByDayCollection).insertMany(salesByDayDocs as Document[])
    result.salesByDay = salesByDayDocs.length
  }
  if (tableDocs.length > 0) {
    await db.collection(tablesCollection).insertMany(tableDocs as Document[])
    result.tables = tableDocs.length
  }
  if (workerDocs.length > 0) {
    await db.collection(workersCollection).insertMany(workerDocs as Document[])
    result.workers = workerDocs.length
  }
  if (orderWorkerDocs.length > 0) {
    await db.collection(orderWorkersCollection).insertMany(orderWorkerDocs as Document[])
    result.orderWorkers = orderWorkerDocs.length
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
