/**
 * @registry-id: v3DashboardSnapshot
 * @created: 2026-04-28T20:00:00.000Z
 * @last-modified: 2026-04-28T20:00:00.000Z
 * @description: Build V3 dashboard snapshot by combining sales + labor snapshots
 * @last-fix: [2026-04-28] Initial V3 dashboard snapshot creation
 * 
 * @exports-to:
 * ✓ server/services/v3Aggregation/v3AggregationOrchestrator.ts
 * ✓ pages/daily-ops/productivity-v3.vue
 * 
 * @data-flow:
 * v3_sales_snapshot + v3_labor_snapshot → compute combined metrics → upsert dashboard snapshot
 * 
 * @business-day: 06:00-05:59:59 UTC
 * @update-frequency: 6x daily (after sales + labor snapshots)
 */

import { Db, ObjectId } from 'mongodb'
import type {
  V3DailyOpsDashboardSnapshot,
  V3SalesWorkingDaySnapshot,
  V3LaborWorkingDaySnapshot,
  SnapshotAggregationResult,
} from '~/types/daily-ops-v3'
import { getCurrentBusinessDate, getBusinessDate } from '~/server/utils/v3BusinessDay'
import {
  getSalesSnapshot,
  getLaborSnapshot,
  upsertDashboardSnapshot,
} from '~/server/utils/v3Snapshots'

/**
 * Build V3 dashboard snapshot by combining sales and labor snapshots
 * This is a denormalized view optimized for dashboard queries
 */
export async function rebuildV3DashboardSnapshot(
  db: Db,
  locationId: ObjectId,
  locationName: string,
  businessDate: string,
): Promise<SnapshotAggregationResult> {
  const startTime = Date.now()
  const stepsExecuted: string[] = []

  try {
    stepsExecuted.push('starting_aggregation')

    // Fetch sales snapshot
    const salesSnapshot = await getSalesSnapshot(db, locationId, businessDate)
    stepsExecuted.push('fetched_sales_snapshot')

    // Fetch labor snapshot
    const laborSnapshot = await getLaborSnapshot(db, locationId, businessDate)
    stepsExecuted.push('fetched_labor_snapshot')

    if (!salesSnapshot || !laborSnapshot) {
      stepsExecuted.push('missing_source_snapshots')
      return {
        success: false,
        message: 'Sales or labor snapshot not found - cannot build dashboard',
        locationId,
        locationName,
        businessDate,
        timestamp: new Date(),
        syncCount: 0,
        durationMs: Date.now() - startTime,
        stepsExecuted,
        error: 'Missing source data',
      }
    }

    stepsExecuted.push('building_dashboard_snapshot')

    // Calculate productivity metrics by combining sales and labor
    const revenuePerLaborHour = laborSnapshot.totalHours > 0 ? salesSnapshot.totalRevenue / laborSnapshot.totalHours : 0
    const laborCostPctOfRevenue =
      salesSnapshot.totalRevenue > 0 ? (laborSnapshot.totalCost / salesSnapshot.totalRevenue) * 100 : 0

    stepsExecuted.push('calculated_combined_metrics')

    // Build top products
    const topProducts = buildTopProducts(salesSnapshot)
    stepsExecuted.push('built_top_products')

    // Build top teams
    const topTeams = laborSnapshot.teams.slice(0, 10).map(team => ({
      teamName: team.teamName,
      workerCount: team.workerCount,
      totalHours: team.totalHours,
      totalCost: team.totalCost,
    }))
    stepsExecuted.push('built_top_teams')

    // Build top contracts
    const topContracts = laborSnapshot.contracts.slice(0, 10).map(contract => ({
      contractType: contract.contractType,
      workerCount: contract.workerCount,
      totalHours: contract.totalHours,
    }))
    stepsExecuted.push('built_top_contracts')

    // Merge hourly data (sales revenue + labor hours/cost)
    const hourlyRevenue = salesSnapshot.hourlyBreakdown || []
    const hourlyLabor = laborSnapshot.hourlyBreakdown || []

    // Add revenue to labor hourly breakdown
    for (const laborEntry of hourlyLabor) {
      const revenueEntry = hourlyRevenue.find(r => r.hour === laborEntry.hour)
      if (revenueEntry) {
        laborEntry.totalRevenue = revenueEntry.totalRevenue
      }
    }

    stepsExecuted.push('merged_hourly_data')

    // Create dashboard snapshot
    const snapshot: V3DailyOpsDashboardSnapshot = {
      locationId,
      locationName,
      businessDate,
      workingDayFinished: getBusinessDate(new Date()) !== businessDate,
      currentHour: new Date().getUTCHours(),
      cards: {
        totalRevenue: salesSnapshot.totalRevenue,
        totalLaborCost: laborSnapshot.totalCost,
        laborCostPctOfRevenue,
        revenuePerLaborHour,
      },
      revenue: {
        totalRevenue: salesSnapshot.totalRevenue,
        totalRevenueExVat: salesSnapshot.totalRevenueExVat,
        totalTransactions: salesSnapshot.totalTransactions,
        avgTransactionValue:
          salesSnapshot.totalTransactions > 0
            ? salesSnapshot.totalRevenue / salesSnapshot.totalTransactions
            : 0,
        drinksRevenue: salesSnapshot.drinksRevenue,
        foodRevenue: salesSnapshot.foodRevenue,
        drinksRevenuePercent: salesSnapshot.drinksRevenuePercent,
      },
      labor: {
        totalHours: laborSnapshot.totalHours,
        totalCost: laborSnapshot.totalCost,
        totalWorkers: laborSnapshot.totalWorkers,
        costPerHour: laborSnapshot.costPerHour,
        revenuePerLaborHour,
        laborCostPctOfRevenue,
      },
      productivity: {
        revenuePerLaborHour,
        laborCostPctOfRevenue,
        bestHour:
          laborSnapshot.productivity.bestHour !== undefined
            ? {
                hour: laborSnapshot.productivity.bestHour,
                efficiency: laborSnapshot.productivity.bestHourEfficiency ?? 0,
              }
            : undefined,
        worstHour:
          laborSnapshot.productivity.worstHour !== undefined
            ? {
                hour: laborSnapshot.productivity.worstHour,
                efficiency: laborSnapshot.productivity.worstHourEfficiency ?? 0,
              }
            : undefined,
      },
      topProducts,
      topTeams,
      topContracts,
      hourlyRevenue,
      hourlyLabor,
      lastUpdatedAt: new Date(),
      syncCount: Math.max(salesSnapshot.syncCount, laborSnapshot.syncCount),
      version: 3,
    }

    stepsExecuted.push('created_dashboard_snapshot_object')

    // Upsert snapshot
    await upsertDashboardSnapshot(db, snapshot)
    stepsExecuted.push('upserted_snapshot')

    return {
      success: true,
      message: 'Dashboard snapshot updated successfully',
      locationId,
      locationName,
      businessDate,
      timestamp: new Date(),
      syncCount: snapshot.syncCount,
      durationMs: Date.now() - startTime,
      stepsExecuted,
      dashboardSnapshot: snapshot,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: 'Dashboard snapshot aggregation failed',
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
 * Extract and sort top products by revenue
 */
function buildTopProducts(
  salesSnapshot: V3SalesWorkingDaySnapshot,
): V3DailyOpsDashboardSnapshot['topProducts'] {
  const products: V3DailyOpsDashboardSnapshot['topProducts'] = []

  // Build from waiter breakdown - we need product-level detail from raw data
  // For now, build from category breakdown
  for (const [category, revenue] of Object.entries(salesSnapshot.revenueByCategory)) {
    products.push({
      name: category,
      quantity: 0, // Would need raw data to calculate properly
      revenue,
      profitPercent: undefined,
    })
  }

  return products.sort((a, b) => b.revenue - a.revenue).slice(0, 20)
}
