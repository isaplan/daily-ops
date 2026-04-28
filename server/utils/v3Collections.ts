/**
 * @registry-id: dailyOpsV3Collections
 * @created: 2026-04-28T19:35:00.000Z
 * @last-modified: 2026-04-28T19:35:00.000Z
 * @description: V3 collection names and indexes for working day snapshots
 * @last-fix: [2026-04-28] Initial V3 collections schema
 * 
 * @exports-to:
 * ✓ server/services/v3Aggregation/v3AggregationOrchestrator.ts
 * ✓ server/services/v3Aggregation/v3SalesSnapshot.ts
 * ✓ server/services/v3Aggregation/v3LaborSnapshot.ts
 * ✓ server/services/v3Aggregation/v3DashboardSnapshot.ts
 * ✓ server/utils/db.ts (for collection initialization)
 */

export const V3_COLLECTIONS = {
  // V3 Working Day Snapshots (updated 6x daily)
  SALES_WORKING_DAY_SNAPSHOT: 'v3_sales_working_day_snapshots',
  LABOR_WORKING_DAY_SNAPSHOT: 'v3_labor_working_day_snapshots',
  DASHBOARD_SNAPSHOT: 'v3_daily_ops_dashboard_snapshots',
  
  // V3 Aggregation metadata (for tracking sync runs)
  AGGREGATION_METADATA: 'v3_aggregation_metadata',
} as const

/**
 * V3 Collection Index Definitions
 * Optimized for fast queries on working day snapshots
 */
export const V3_COLLECTION_INDEXES = {
  [V3_COLLECTIONS.SALES_WORKING_DAY_SNAPSHOT]: [
    { key: { locationId: 1, businessDate: -1 }, options: { unique: true, name: 'idx_location_businessdate' } },
    { key: { businessDate: -1 }, options: { name: 'idx_businessdate' } },
    { key: { workingDayFinished: 1 }, options: { name: 'idx_workingdayfinished' } },
    { key: { lastUpdatedAt: -1 }, options: { name: 'idx_lastupdatedat' } },
  ],
  
  [V3_COLLECTIONS.LABOR_WORKING_DAY_SNAPSHOT]: [
    { key: { locationId: 1, businessDate: -1 }, options: { unique: true, name: 'idx_location_businessdate' } },
    { key: { businessDate: -1 }, options: { name: 'idx_businessdate' } },
    { key: { workingDayFinished: 1 }, options: { name: 'idx_workingdayfinished' } },
    { key: { lastUpdatedAt: -1 }, options: { name: 'idx_lastupdatedat' } },
  ],
  
  [V3_COLLECTIONS.DASHBOARD_SNAPSHOT]: [
    { key: { locationId: 1, businessDate: -1 }, options: { unique: true, name: 'idx_location_businessdate' } },
    { key: { businessDate: -1 }, options: { name: 'idx_businessdate' } },
    { key: { workingDayFinished: 1 }, options: { name: 'idx_workingdayfinished' } },
    { key: { lastUpdatedAt: -1 }, options: { name: 'idx_lastupdatedat' } },
  ],
  
  [V3_COLLECTIONS.AGGREGATION_METADATA]: [
    { key: { businessDate: -1 }, options: { name: 'idx_businessdate' } },
    { key: { locationId: 1, businessDate: -1 }, options: { name: 'idx_location_businessdate' } },
    { key: { completedAt: -1 }, options: { name: 'idx_completedat' } },
  ],
} as const

/**
 * Initialize V3 collections with indexes
 * Call this during app startup or during migration
 */
export async function initializeV3Collections(db: any) {
  for (const [collectionName, indexes] of Object.entries(V3_COLLECTION_INDEXES)) {
    const collection = db.collection(collectionName)
    
    for (const indexDef of indexes) {
      try {
        await collection.createIndex(indexDef.key, indexDef.options)
        console.log(`[V3 Collections] Created index on ${collectionName}: ${indexDef.options.name}`)
      } catch (e) {
        console.warn(`[V3 Collections] Index ${indexDef.options.name} may already exist on ${collectionName}`)
      }
    }
  }
}
