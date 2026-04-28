/**
 * @registry-id: dailyOpsV3Types
 * @created: 2026-04-28T19:30:00.000Z
 * @last-modified: 2026-04-28T19:30:00.000Z
 * @description: V3 aggregation snapshot types - working day snapshots for live dashboards
 * @last-fix: [2026-04-28] Initial V3 types for sales, labor, and dashboard snapshots
 * 
 * @exports-to:
 * ✓ server/services/v3Aggregation/v3AggregationOrchestrator.ts
 * ✓ server/services/v3Aggregation/v3SalesSnapshot.ts
 * ✓ server/services/v3Aggregation/v3LaborSnapshot.ts
 * ✓ server/services/v3Aggregation/v3DashboardSnapshot.ts
 * ✓ pages/daily-ops/productivity-v3.vue
 * ✓ pages/daily-ops/sales-v3/*.vue
 * ✓ pages/daily-ops/hours-v3/*.vue
 * 
 * @schema-version: 3
 * @update-frequency: 6x daily (06:00, 13:00, 16:00, 18:00, 20:00, 22:00 UTC)
 * @business-day: 06:00 UTC (start) → 05:59:59 UTC next day (end)
 */

import { ObjectId } from 'mongodb'

// ============================================
// WORKING DAY DEFINITION TYPES
// ============================================

export interface WorkingDayMetadata {
  businessDate: string                    // "2026-04-26" (ISO date when business day starts)
  workingDayStart: Date                   // 2026-04-26T06:00:00Z
  workingDayEnd: Date                     // 2026-04-27T05:59:59Z
  workingDayStarted: boolean              // true when Part 1 (06:00+) data arrives
  workingDayFinished: boolean             // true at 05:59 UTC or when next day starts
}

export interface HourlyBreakdownEntry {
  hour: number                            // 0-23 (UTC)
  isoDate: Date                           // Which ISO date this hour belongs to
  totalRevenue: number                    // Cumulative up to this hour
  totalRevenueExVat?: number
  totalRevenueIncVat?: number
  totalQuantity?: number
  totalTransactions?: number
  totalHours?: number                     // For labor breakdown
  totalCost?: number                      // For labor breakdown
  totalWorkers?: number                   // For labor breakdown
  revenueByCategory?: Record<string, number>
  byTeam?: Array<{ teamName: string; hours: number; cost: number }>
}

// ============================================
// PART 1 & PART 2 BREAKDOWN TYPES
// ============================================

export interface SalesDayPart {
  date: Date                              // ISO date (Part 1 or Part 2 date)
  totalRevenue: number
  totalRevenueExVat: number
  totalRevenueIncVat: number
  totalVat: number
  totalQuantity: number
  totalTransactions: number
  revenueByCategory: Record<string, number>
  drinksRevenue: number
  foodRevenue: number
}

export interface LaborDayPart {
  date: Date                              // ISO date
  totalHours: number
  totalCost: number
  totalWorkers: number
  workerCount: number
}

// ============================================
// V3 SALES WORKING DAY SNAPSHOT
// ============================================

export interface V3SalesWorkingDaySnapshot {
  _id?: ObjectId
  locationId: ObjectId
  locationName: string
  
  // Working day definition
  businessDate: string
  workingDayStart: Date
  workingDayEnd: Date
  workingDayStarted: boolean
  workingDayFinished: boolean
  
  // Part 1 (06:00-23:59 on businessDate)
  part1?: SalesDayPart
  
  // Part 2 (00:00-05:59 on businessDate+1)
  part2?: SalesDayPart
  
  // COMBINED TOTALS (what dashboard shows)
  totalRevenue: number
  totalRevenueExVat: number
  totalRevenueIncVat: number
  totalVat: number
  totalQuantity: number
  totalTransactions: number
  avgRevenuePerTransaction: number
  
  // CATEGORY BREAKDOWN
  revenueByCategory: Record<string, number>
  drinksRevenue: number
  foodRevenue: number
  drinksRevenuePercent: number
  
  // HOURLY BREAKDOWN (cumulative)
  hourlyBreakdown: HourlyBreakdownEntry[]
  
  // WAITER BREAKDOWN
  byWaiter: Array<{
    name: string
    revenue: number
    transactions: number
    itemsSold: number
  }>
  
  // TABLE BREAKDOWN
  byTable: Array<{
    tableNumber: string
    revenue: number
    transactions: number
  }>
  
  // PAYMENT METHOD BREAKDOWN
  byPaymentMethod: Array<{
    method: string
    revenue: number
    transactions: number
  }>
  
  // METADATA
  lastUpdatedAt: Date                     // When snapshot was last updated
  syncCount: number                       // How many times aggregated today
  version: 3
}

// ============================================
// V3 LABOR WORKING DAY SNAPSHOT
// ============================================

export interface TeamSummary {
  teamId: string
  teamName: string
  workerCount: number
  totalHours: number
  totalCost: number
  pctOfTotalHours: number
}

export interface ContractSummary {
  contractType: string                    // "uren contract", "zzp", "nul uren", etc.
  workerCount: number
  totalHours: number
  totalCost: number
  pctOfTotalHours: number
}

export interface LaborProductivityMetrics {
  revenuePerLaborHour?: number            // totalRevenue / totalHours
  laborCostPctOfRevenue?: number          // totalCost / totalRevenue
  bestHour?: number                       // Hour with highest efficiency
  worstHour?: number                      // Hour with lowest efficiency
  bestHourEfficiency?: number
  worstHourEfficiency?: number
}

export interface V3LaborWorkingDaySnapshot {
  _id?: ObjectId
  locationId: ObjectId
  locationName: string
  
  // Working day definition
  businessDate: string
  workingDayStart: Date
  workingDayEnd: Date
  workingDayStarted: boolean
  workingDayFinished: boolean
  
  // COMBINED TOTALS
  totalHours: number
  totalCost: number
  totalWorkers: number                    // Distinct worker count
  costPerHour: number
  revenuePerHour?: number                 // From sales snapshot (computed)
  
  // TEAMS SUMMARY (aggregated by team name)
  teams: TeamSummary[]
  
  // CONTRACTS SUMMARY (aggregated by contract type)
  contracts: ContractSummary[]
  
  // PRODUCTIVITY METRICS
  productivity: LaborProductivityMetrics
  
  // HOURLY BREAKDOWN (cumulative)
  hourlyBreakdown: HourlyBreakdownEntry[]
  
  // METADATA
  lastUpdatedAt: Date
  syncCount: number
  version: 3
}

// ============================================
// V3 DASHBOARD SNAPSHOT (DENORMALIZED)
// ============================================

export interface DashboardSalesCard {
  totalRevenue: number
  totalRevenueExVat: number
  totalTransactions: number
  avgTransactionValue: number
  drinksRevenue: number
  foodRevenue: number
  drinksRevenuePercent: number
}

export interface DashboardLaborCard {
  totalHours: number
  totalCost: number
  totalWorkers: number
  costPerHour: number
  revenuePerLaborHour?: number
  laborCostPctOfRevenue?: number
}

export interface DashboardProductivityCard {
  revenuePerLaborHour?: number
  laborCostPctOfRevenue?: number
  bestHour?: { hour: number; efficiency: number }
  worstHour?: { hour: number; efficiency: number }
}

export interface V3DailyOpsDashboardSnapshot {
  _id?: ObjectId
  locationId: ObjectId
  locationName: string
  
  // Working day reference
  businessDate: string
  workingDayFinished: boolean
  currentHour?: number                    // UTC hour when last updated
  
  // SUMMARY CARDS
  cards: {
    totalRevenue: number
    totalLaborCost: number
    laborCostPctOfRevenue?: number
    revenuePerLaborHour?: number
  }
  
  // REVENUE METRICS (from sales snapshot)
  revenue: DashboardSalesCard
  
  // LABOR METRICS (from labor snapshot)
  labor: DashboardLaborCard
  
  // PRODUCTIVITY METRICS (computed)
  productivity: DashboardProductivityCard
  
  // TOP ITEMS
  topProducts: Array<{
    name: string
    quantity: number
    revenue: number
    profitPercent?: number
  }>
  
  topTeams: Array<{
    teamName: string
    workerCount: number
    totalHours: number
    totalCost: number
  }>
  
  topContracts: Array<{
    contractType: string
    workerCount: number
    totalHours: number
  }>
  
  // HOURLY DATA FOR CHARTS
  hourlyRevenue: HourlyBreakdownEntry[]
  hourlyLabor: HourlyBreakdownEntry[]
  
  // METADATA
  lastUpdatedAt: Date
  syncCount: number
  version: 3
}

// ============================================
// AGGREGATION RESULT TYPES
// ============================================

export interface SnapshotAggregationResult {
  success: boolean
  message: string
  locationId: ObjectId
  locationName: string
  businessDate: string
  timestamp: Date
  syncCount: number
  
  // Timing info for debugging
  durationMs: number
  stepsExecuted: string[]
  
  // Results summary
  salesSnapshot?: V3SalesWorkingDaySnapshot
  laborSnapshot?: V3LaborWorkingDaySnapshot
  dashboardSnapshot?: V3DailyOpsDashboardSnapshot
  
  error?: string
}

export interface V3AggregationPipelineResult {
  success: boolean
  startedAt: Date
  completedAt: Date
  durationMs: number
  
  // Per-location results
  locations: SnapshotAggregationResult[]
  
  // Overall summary
  totalLocations: number
  successCount: number
  failureCount: number
  
  // Metadata
  businessDate: string
  workingDayFinished: boolean
  syncCount: number
  
  message: string
  error?: string
}

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface V3AggregationConfig {
  enabled: boolean
  businessDayStartHour: number            // 6 (06:00 UTC)
  businessDayEndHour: number              // 5 (05:59:59 UTC next day)
  cronSchedule: string[]                  // ["0 6 * * *", "0 13 * * *", ...]
  maxRetries: number
  retryDelayMs: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

// ============================================
// EXPORT TYPES FOR RE-USE
// ============================================

export type V3Snapshot = V3SalesWorkingDaySnapshot | V3LaborWorkingDaySnapshot | V3DailyOpsDashboardSnapshot
export type SnapshotType = 'sales' | 'labor' | 'dashboard'
