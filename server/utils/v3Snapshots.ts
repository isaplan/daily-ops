/**
 * @registry-id: dailyOpsV3SnapshotUtils
 * @created: 2026-04-28T19:45:00.000Z
 * @last-modified: 2026-04-28T19:45:00.000Z
 * @description: V3 snapshot utility functions for querying and manipulating snapshots
 * @last-fix: [2026-04-28] Initial snapshot utilities
 * 
 * @exports-to:
 * ✓ server/services/v3Aggregation/v3AggregationOrchestrator.ts
 * ✓ server/services/v3Aggregation/v3SalesSnapshot.ts
 * ✓ server/services/v3Aggregation/v3LaborSnapshot.ts
 * ✓ server/services/v3Aggregation/v3DashboardSnapshot.ts
 * ✓ server/api/daily-ops-v3/sales.get.ts
 * ✓ server/api/daily-ops-v3/labor.get.ts
 */

import { Db, ObjectId } from 'mongodb'
import { V3_COLLECTIONS } from './v3Collections'
import type {
  V3SalesWorkingDaySnapshot,
  V3LaborWorkingDaySnapshot,
  V3DailyOpsDashboardSnapshot,
  SnapshotAggregationResult,
} from '~/types/daily-ops-v3'

/**
 * Get current sales snapshot for a location and business date
 */
export async function getSalesSnapshot(
  db: Db,
  locationId: ObjectId,
  businessDate: string,
): Promise<V3SalesWorkingDaySnapshot | null> {
  return db
    .collection(V3_COLLECTIONS.SALES_WORKING_DAY_SNAPSHOT)
    .findOne({ locationId, businessDate }) as Promise<V3SalesWorkingDaySnapshot | null>
}

/**
 * Get current labor snapshot for a location and business date
 */
export async function getLaborSnapshot(
  db: Db,
  locationId: ObjectId,
  businessDate: string,
): Promise<V3LaborWorkingDaySnapshot | null> {
  return db
    .collection(V3_COLLECTIONS.LABOR_WORKING_DAY_SNAPSHOT)
    .findOne({ locationId, businessDate }) as Promise<V3LaborWorkingDaySnapshot | null>
}

/**
 * Get dashboard snapshot for a location and business date
 */
export async function getDashboardSnapshot(
  db: Db,
  locationId: ObjectId,
  businessDate: string,
): Promise<V3DailyOpsDashboardSnapshot | null> {
  return db
    .collection(V3_COLLECTIONS.DASHBOARD_SNAPSHOT)
    .findOne({ locationId, businessDate }) as Promise<V3DailyOpsDashboardSnapshot | null>
}

/**
 * Upsert sales snapshot
 */
export async function upsertSalesSnapshot(
  db: Db,
  snapshot: V3SalesWorkingDaySnapshot,
): Promise<ObjectId> {
  const result = await db
    .collection(V3_COLLECTIONS.SALES_WORKING_DAY_SNAPSHOT)
    .updateOne(
      { locationId: snapshot.locationId, businessDate: snapshot.businessDate },
      { $set: snapshot },
      { upsert: true },
    )

  return snapshot._id || result.upsertedId || new ObjectId()
}

/**
 * Upsert labor snapshot
 */
export async function upsertLaborSnapshot(
  db: Db,
  snapshot: V3LaborWorkingDaySnapshot,
): Promise<ObjectId> {
  const result = await db
    .collection(V3_COLLECTIONS.LABOR_WORKING_DAY_SNAPSHOT)
    .updateOne(
      { locationId: snapshot.locationId, businessDate: snapshot.businessDate },
      { $set: snapshot },
      { upsert: true },
    )

  return snapshot._id || result.upsertedId || new ObjectId()
}

/**
 * Upsert dashboard snapshot
 */
export async function upsertDashboardSnapshot(
  db: Db,
  snapshot: V3DailyOpsDashboardSnapshot,
): Promise<ObjectId> {
  const result = await db
    .collection(V3_COLLECTIONS.DASHBOARD_SNAPSHOT)
    .updateOne(
      { locationId: snapshot.locationId, businessDate: snapshot.businessDate },
      { $set: snapshot },
      { upsert: true },
    )

  return snapshot._id || result.upsertedId || new ObjectId()
}

/**
 * Get all snapshots for a location across multiple dates
 * Useful for charts/trends
 */
export async function getSalesSnapshotsByLocationRange(
  db: Db,
  locationId: ObjectId,
  startDate: string,
  endDate: string,
): Promise<V3SalesWorkingDaySnapshot[]> {
  return db
    .collection(V3_COLLECTIONS.SALES_WORKING_DAY_SNAPSHOT)
    .find({
      locationId,
      businessDate: { $gte: startDate, $lte: endDate },
    })
    .sort({ businessDate: -1 })
    .toArray() as Promise<V3SalesWorkingDaySnapshot[]>
}

/**
 * Get latest snapshot for all locations (for dashboard)
 */
export async function getLatestSalesSnapshotsAllLocations(
  db: Db,
  businessDate: string,
): Promise<V3SalesWorkingDaySnapshot[]> {
  return db
    .collection(V3_COLLECTIONS.SALES_WORKING_DAY_SNAPSHOT)
    .find({ businessDate })
    .toArray() as Promise<V3SalesWorkingDaySnapshot[]>
}

/**
 * Record aggregation metadata for audit/debugging
 */
export async function recordAggregationMetadata(
  db: Db,
  result: SnapshotAggregationResult,
): Promise<void> {
  await db.collection(V3_COLLECTIONS.AGGREGATION_METADATA).insertOne({
    ...result,
    recordedAt: new Date(),
  })
}

/**
 * Get aggregation history for debugging
 */
export async function getAggregationHistory(
  db: Db,
  businessDate: string,
  limit: number = 10,
): Promise<SnapshotAggregationResult[]> {
  return db
    .collection(V3_COLLECTIONS.AGGREGATION_METADATA)
    .find({ businessDate })
    .sort({ recordedAt: -1 })
    .limit(limit)
    .toArray() as Promise<SnapshotAggregationResult[]>
}

/**
 * Clear old snapshots (retention policy)
 * Keep snapshots for last 90 days
 */
export async function cleanupOldSnapshots(
  db: Db,
  daysToKeep: number = 90,
): Promise<{ deletedSales: number; deletedLabor: number; deletedDashboard: number }> {
  const cutoffDate = new Date()
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysToKeep)
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

  const deletedSales = await db
    .collection(V3_COLLECTIONS.SALES_WORKING_DAY_SNAPSHOT)
    .deleteMany({ businessDate: { $lt: cutoffDateStr } })

  const deletedLabor = await db
    .collection(V3_COLLECTIONS.LABOR_WORKING_DAY_SNAPSHOT)
    .deleteMany({ businessDate: { $lt: cutoffDateStr } })

  const deletedDashboard = await db
    .collection(V3_COLLECTIONS.DASHBOARD_SNAPSHOT)
    .deleteMany({ businessDate: { $lt: cutoffDateStr } })

  return {
    deletedSales: deletedSales.deletedCount,
    deletedLabor: deletedLabor.deletedCount,
    deletedDashboard: deletedDashboard.deletedCount,
  }
}

/**
 * Check if snapshot needs updating (based on sync count and time elapsed)
 */
export function shouldUpdateSnapshot(
  snapshot: V3SalesWorkingDaySnapshot | V3LaborWorkingDaySnapshot | null,
  maxAgeMins: number = 15,
): boolean {
  if (!snapshot) return true

  const now = new Date()
  const lastUpdate = new Date(snapshot.lastUpdatedAt)
  const ageMs = now.getTime() - lastUpdate.getTime()
  const ageMins = ageMs / (1000 * 60)

  return ageMins > maxAgeMins
}
