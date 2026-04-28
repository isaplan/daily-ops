/**
 * @registry-id: v3SalesSnapshot
 * @created: 2026-04-28T19:50:00.000Z
 * @last-modified: 2026-04-28T19:50:00.000Z
 * @description: Build V3 sales working day snapshots from raw Bork data
 * @last-fix: [2026-04-28] Initial V3 sales snapshot aggregation
 * 
 * @exports-to:
 * ✓ server/services/v3Aggregation/v3AggregationOrchestrator.ts
 * 
 * @data-flow:
 * bork_raw_sales → $match(businessDayRange) → $group(hourly) → upsert snapshot
 * 
 * @business-day: 06:00-05:59:59 UTC
 * @update-frequency: 6x daily (triggered after Bork sync)
 */

import { Db, ObjectId } from 'mongodb'
import type {
  V3SalesWorkingDaySnapshot,
  SalesDayPart,
  HourlyBreakdownEntry,
  SnapshotAggregationResult,
} from '~/types/daily-ops-v3'
import {
  getBusinessDate,
  getBusinessDayStart,
  getBusinessDayEnd,
  getBusinessDayPart1Date,
  getBusinessDayPart2Date,
  getBusinessDayPart,
  toISODateString,
  getCurrentBusinessDate,
} from '~/server/utils/v3BusinessDay'
import { upsertSalesSnapshot, shouldUpdateSnapshot, getSalesSnapshot } from '~/server/utils/v3Snapshots'

/**
 * Rebuild V3 sales working day snapshot for a specific location and date
 * Aggregates all Bork raw sales data for the business day
 */
export async function rebuildV3SaleSnapshot(
  db: Db,
  locationId: ObjectId,
  locationName: string,
  businessDate: string,
): Promise<SnapshotAggregationResult> {
  const startTime = Date.now()
  const stepsExecuted: string[] = []

  try {
    stepsExecuted.push('starting_aggregation')

    // Get business day boundaries
    const workingDayStart = getBusinessDayStart(businessDate)
    const workingDayEnd = getBusinessDayEnd(businessDate)
    const part1Date = getBusinessDayPart1Date(businessDate)
    const part2Date = getBusinessDayPart2Date(businessDate)

    stepsExecuted.push('fetched_business_day_boundaries')

    // Check if we should update (if snapshot exists and is recent, maybe skip)
    const existingSnapshot = await getSalesSnapshot(db, locationId, businessDate)
    const shouldUpdate = shouldUpdateSnapshot(existingSnapshot, 15)

    if (!shouldUpdate && existingSnapshot) {
      stepsExecuted.push('snapshot_recent_skipped_update')
      return {
        success: true,
        message: 'Snapshot already up-to-date',
        locationId,
        locationName,
        businessDate,
        timestamp: new Date(),
        syncCount: existingSnapshot.syncCount + 1,
        durationMs: Date.now() - startTime,
        stepsExecuted,
        salesSnapshot: existingSnapshot,
      }
    }

    stepsExecuted.push('querying_raw_sales_data')

    // Aggregate Part 1 (06:00-23:59 on part1Date)
    const part1Pipeline = [
      {
        $match: {
          locationId,
          date: {
            $gte: workingDayStart,
            $lt: new Date(part1Date.getTime() + 24 * 60 * 60 * 1000), // End of part1Date
          },
        },
      },
      {
        $addFields: {
          isoDate: {
            $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' },
          },
          hour: { $hour: { date: '$date', timezone: 'UTC' } },
        },
      },
      {
        $group: {
          _id: {
            isoDate: '$isoDate',
            hour: '$hour',
          },
          totalRevenue: { $sum: '$lineTotal' },
          totalRevenueExVat: { $sum: { $ifNull: ['$lineTotalExVat', '$lineTotal'] } },
          totalRevenueIncVat: { $sum: { $ifNull: ['$lineTotalIncVat', '$lineTotal'] } },
          totalVat: { $sum: { $subtract: [{ $ifNull: ['$lineTotalIncVat', '$lineTotal'] }, '$lineTotal'] } },
          totalQuantity: { $sum: '$quantity' },
          drinksRevenue: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$productName', regex: /drink|beverage|coffee|tea|juice|water/i } },
                '$lineTotal',
                0,
              ],
            },
          },
          transactions: { $addToSet: '$transactionId' },
          waiters: { $addToSet: '$waiterName' },
          tables: { $addToSet: '$tableNumber' },
          categories: { $push: { category: '$productCategory', revenue: '$lineTotal' } },
        },
      },
    ]

    const part1Data = await db.collection('bork_raw_sales').aggregate(part1Pipeline).toArray()
    stepsExecuted.push('aggregated_part1_data')

    // Aggregate Part 2 (00:00-05:59 on part2Date)
    const part2Pipeline = [
      {
        $match: {
          locationId,
          date: {
            $gte: part2Date,
            $lt: workingDayEnd,
          },
        },
      },
      {
        $addFields: {
          isoDate: {
            $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' },
          },
          hour: { $hour: { date: '$date', timezone: 'UTC' } },
        },
      },
      {
        $group: {
          _id: {
            isoDate: '$isoDate',
            hour: '$hour',
          },
          totalRevenue: { $sum: '$lineTotal' },
          totalRevenueExVat: { $sum: { $ifNull: ['$lineTotalExVat', '$lineTotal'] } },
          totalRevenueIncVat: { $sum: { $ifNull: ['$lineTotalIncVat', '$lineTotal'] } },
          totalVat: { $sum: { $subtract: [{ $ifNull: ['$lineTotalIncVat', '$lineTotal'] }, '$lineTotal'] } },
          totalQuantity: { $sum: '$quantity' },
          drinksRevenue: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$productName', regex: /drink|beverage|coffee|tea|juice|water/i } },
                '$lineTotal',
                0,
              ],
            },
          },
          transactions: { $addToSet: '$transactionId' },
          waiters: { $addToSet: '$waiterName' },
          tables: { $addToSet: '$tableNumber' },
          categories: { $push: { category: '$productCategory', revenue: '$lineTotal' } },
        },
      },
    ]

    const part2Data = await db.collection('bork_raw_sales').aggregate(part2Pipeline).toArray()
    stepsExecuted.push('aggregated_part2_data')

    // Build Part 1 summary
    const part1: SalesDayPart = buildDayPartSummary(part1Data, part1Date)
    stepsExecuted.push('built_part1_summary')

    // Build Part 2 summary
    const part2: SalesDayPart = buildDayPartSummary(part2Data, part2Date)
    stepsExecuted.push('built_part2_summary')

    // Build hourly breakdown
    const allData = [...part1Data, ...part2Data]
    const hourlyBreakdown = buildHourlyBreakdown(allData)
    stepsExecuted.push('built_hourly_breakdown')

    // Calculate combined totals
    const totalRevenue = (part1?.totalRevenue ?? 0) + (part2?.totalRevenue ?? 0)
    const totalRevenueExVat = (part1?.totalRevenueExVat ?? 0) + (part2?.totalRevenueExVat ?? 0)
    const totalRevenueIncVat = (part1?.totalRevenueIncVat ?? 0) + (part2?.totalRevenueIncVat ?? 0)
    const totalVat = (part1?.totalVat ?? 0) + (part2?.totalVat ?? 0)
    const totalQuantity = (part1?.totalQuantity ?? 0) + (part2?.totalQuantity ?? 0)
    const totalTransactions = (part1?.totalTransactions ?? 0) + (part2?.totalTransactions ?? 0)
    const drinksRevenue = (part1?.drinksRevenue ?? 0) + (part2?.drinksRevenue ?? 0)
    const foodRevenue = totalRevenue - drinksRevenue

    stepsExecuted.push('calculated_combined_totals')

    // Build category breakdown
    const revenueByCategory: Record<string, number> = {}
    for (const entry of allData) {
      if (entry.categories) {
        for (const cat of entry.categories) {
          revenueByCategory[cat.category] = (revenueByCategory[cat.category] ?? 0) + cat.revenue
        }
      }
    }

    // Get waiter breakdown
    const byWaiter = await buildWaiterBreakdown(db, locationId, businessDate)
    stepsExecuted.push('built_waiter_breakdown')

    // Get table breakdown
    const byTable = await buildTableBreakdown(db, locationId, businessDate)
    stepsExecuted.push('built_table_breakdown')

    // Get payment method breakdown
    const byPaymentMethod = await buildPaymentMethodBreakdown(db, locationId, businessDate)
    stepsExecuted.push('built_payment_method_breakdown')

    // Create snapshot
    const snapshot: V3SalesWorkingDaySnapshot = {
      locationId,
      locationName,
      businessDate,
      workingDayStart,
      workingDayEnd,
      workingDayStarted: true,
      workingDayFinished: getBusinessDate(new Date()) !== businessDate, // True if past this business day
      part1: part1?.totalRevenue > 0 ? part1 : undefined,
      part2: part2?.totalRevenue > 0 ? part2 : undefined,
      totalRevenue,
      totalRevenueExVat,
      totalRevenueIncVat,
      totalVat,
      totalQuantity,
      totalTransactions,
      avgRevenuePerTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      revenueByCategory,
      drinksRevenue,
      foodRevenue,
      drinksRevenuePercent: totalRevenue > 0 ? (drinksRevenue / totalRevenue) * 100 : 0,
      hourlyBreakdown,
      byWaiter,
      byTable,
      byPaymentMethod,
      lastUpdatedAt: new Date(),
      syncCount: (existingSnapshot?.syncCount ?? 0) + 1,
      version: 3,
    }

    stepsExecuted.push('created_snapshot_object')

    // Upsert snapshot
    await upsertSalesSnapshot(db, snapshot)
    stepsExecuted.push('upserted_snapshot')

    return {
      success: true,
      message: 'Sales snapshot updated successfully',
      locationId,
      locationName,
      businessDate,
      timestamp: new Date(),
      syncCount: snapshot.syncCount,
      durationMs: Date.now() - startTime,
      stepsExecuted,
      salesSnapshot: snapshot,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: 'Sales snapshot aggregation failed',
      locationId,
      locationName,
      businessDate,
      timestamp: new Date(),
      syncCount: 0,
      durationMs: Date.now() - startTime,
      stepsExecuted,
      error: errorMsg,
    }
  }
}

/**
 * Build summary for a day part (Part 1 or Part 2)
 */
function buildDayPartSummary(data: any[], date: Date): SalesDayPart {
  let totalRevenue = 0
  let totalRevenueExVat = 0
  let totalRevenueIncVat = 0
  let totalVat = 0
  let totalQuantity = 0
  let transactions = new Set<string>()
  let drinksRevenue = 0

  for (const entry of data) {
    totalRevenue += entry.totalRevenue ?? 0
    totalRevenueExVat += entry.totalRevenueExVat ?? 0
    totalRevenueIncVat += entry.totalRevenueIncVat ?? 0
    totalVat += entry.totalVat ?? 0
    totalQuantity += entry.totalQuantity ?? 0
    drinksRevenue += entry.drinksRevenue ?? 0

    if (entry.transactions) {
      for (const txn of entry.transactions) {
        transactions.add(txn)
      }
    }
  }

  return {
    date,
    totalRevenue,
    totalRevenueExVat,
    totalRevenueIncVat,
    totalVat,
    totalQuantity,
    totalTransactions: transactions.size,
    revenueByCategory: {},
    drinksRevenue,
    foodRevenue: totalRevenue - drinksRevenue,
  }
}

/**
 * Build hourly breakdown with cumulative totals
 */
function buildHourlyBreakdown(data: any[]): HourlyBreakdownEntry[] {
  const hourMap = new Map<number, any>()

  for (const entry of data) {
    const hour = entry._id.hour
    if (!hourMap.has(hour)) {
      hourMap.set(hour, {
        hour,
        totalRevenue: 0,
        totalQuantity: 0,
        totalTransactions: 0,
      })
    }

    const hourEntry = hourMap.get(hour)
    hourEntry.totalRevenue += entry.totalRevenue ?? 0
    hourEntry.totalQuantity += entry.totalQuantity ?? 0
    hourEntry.totalTransactions += (entry.transactions?.length ?? 0)
  }

  // Sort by hour and build cumulative breakdown
  const sortedHours = Array.from(hourMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, data]) => data)

  let cumulativeRevenue = 0
  const breakdown: HourlyBreakdownEntry[] = []

  for (const hourEntry of sortedHours) {
    cumulativeRevenue += hourEntry.totalRevenue
    breakdown.push({
      hour: hourEntry.hour,
      isoDate: new Date(),
      totalRevenue: cumulativeRevenue,
      totalQuantity: hourEntry.totalQuantity,
      totalTransactions: hourEntry.totalTransactions,
    })
  }

  return breakdown
}

/**
 * Build waiter breakdown
 */
async function buildWaiterBreakdown(
  db: Db,
  locationId: ObjectId,
  businessDate: string,
): Promise<V3SalesWorkingDaySnapshot['byWaiter']> {
  const workingDayStart = getBusinessDayStart(businessDate)
  const workingDayEnd = getBusinessDayEnd(businessDate)

  const pipeline = [
    {
      $match: {
        locationId,
        date: { $gte: workingDayStart, $lt: workingDayEnd },
      },
    },
    {
      $group: {
        _id: '$waiterName',
        revenue: { $sum: '$lineTotal' },
        transactions: { $addToSet: '$transactionId' },
        itemsSold: { $sum: '$quantity' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 20 },
  ]

  const results = await db.collection('bork_raw_sales').aggregate(pipeline).toArray()

  return results.map((r: any) => ({
    name: r._id ?? 'Unknown',
    revenue: r.revenue ?? 0,
    transactions: r.transactions?.length ?? 0,
    itemsSold: r.itemsSold ?? 0,
  }))
}

/**
 * Build table breakdown
 */
async function buildTableBreakdown(
  db: Db,
  locationId: ObjectId,
  businessDate: string,
): Promise<V3SalesWorkingDaySnapshot['byTable']> {
  const workingDayStart = getBusinessDayStart(businessDate)
  const workingDayEnd = getBusinessDayEnd(businessDate)

  const pipeline = [
    {
      $match: {
        locationId,
        date: { $gte: workingDayStart, $lt: workingDayEnd },
      },
    },
    {
      $group: {
        _id: '$tableNumber',
        revenue: { $sum: '$lineTotal' },
        transactions: { $addToSet: '$transactionId' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 50 },
  ]

  const results = await db.collection('bork_raw_sales').aggregate(pipeline).toArray()

  return results.map((r: any) => ({
    tableNumber: r._id ?? 'Unknown',
    revenue: r.revenue ?? 0,
    transactions: r.transactions?.length ?? 0,
  }))
}

/**
 * Build payment method breakdown
 */
async function buildPaymentMethodBreakdown(
  db: Db,
  locationId: ObjectId,
  businessDate: string,
): Promise<V3SalesWorkingDaySnapshot['byPaymentMethod']> {
  const workingDayStart = getBusinessDayStart(businessDate)
  const workingDayEnd = getBusinessDayEnd(businessDate)

  const pipeline = [
    {
      $match: {
        locationId,
        date: { $gte: workingDayStart, $lt: workingDayEnd },
      },
    },
    {
      $group: {
        _id: '$paymentMethod',
        revenue: { $sum: '$lineTotal' },
        transactions: { $addToSet: '$transactionId' },
      },
    },
    { $sort: { revenue: -1 } },
  ]

  const results = await db.collection('bork_raw_sales').aggregate(pipeline).toArray()

  return results.map((r: any) => ({
    method: r._id ?? 'Unknown',
    revenue: r.revenue ?? 0,
    transactions: r.transactions?.length ?? 0,
  }))
}
