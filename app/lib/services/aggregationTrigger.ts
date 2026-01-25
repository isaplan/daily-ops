/**
 * @registry-id: aggregationTrigger
 * @created: 2026-01-25T00:00:00.000Z
 * @last-modified: 2026-01-25T00:00:00.000Z
 * @description: Service to trigger aggregation only if data has changed since last update
 * @last-fix: [2026-01-25] Renamed aggregation_lock to eitje_aggregation_lock
 * 
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - app/lib/services/aggregationService.ts => aggregateAll
 *   - app/lib/services/unifiedCollectionsService.ts => syncAllUnified
 * 
 * @exports-to:
 *   ✓ app/lib/cron/v2-cron-manager.ts => triggers after successful sync
 */

import { getDatabase } from '@/lib/mongodb/v2-connection';
import { aggregateAll, AggregationType, AggregationPeriod } from '@/lib/services/aggregationService';
import { syncAllUnified } from '@/lib/services/unifiedCollectionsService';

interface AggregationLock {
  _id?: string;
  isRunning: boolean;
  startedAt?: Date;
  lastCompleted?: Date;
  lastError?: string;
}

/**
 * Check if eitje_raw_data has changed since last aggregation
 */
async function hasDataChangedSinceLastAggregation(
  db: any,
  lastAggregationTime: Date | null
): Promise<{ changed: boolean; newRecordsCount: number; lastRecordTime: Date | null }> {
  if (!lastAggregationTime) {
    // No previous aggregation - check if there's any data
    const count = await db.collection('eitje_raw_data').countDocuments({});
    const lastRecord = await db.collection('eitje_raw_data')
      .findOne({}, { sort: { createdAt: -1 } });
    
    return {
      changed: count > 0,
      newRecordsCount: count,
      lastRecordTime: lastRecord?.createdAt ? new Date(lastRecord.createdAt) : null,
    };
  }

  // Check for new or updated records since last aggregation
  const newRecordsCount = await db.collection('eitje_raw_data').countDocuments({
    $or: [
      { createdAt: { $gt: lastAggregationTime } },
      { updatedAt: { $gt: lastAggregationTime } },
    ],
  });

  const lastRecord = await db.collection('eitje_raw_data')
    .findOne(
      {
        $or: [
          { createdAt: { $gt: lastAggregationTime } },
          { updatedAt: { $gt: lastAggregationTime } },
        ],
      },
      { sort: { createdAt: -1 } }
    );

  return {
    changed: newRecordsCount > 0,
    newRecordsCount,
    lastRecordTime: lastRecord?.createdAt ? new Date(lastRecord.createdAt) : null,
  };
}

/**
 * Get or create aggregation lock
 */
async function getAggregationLock(db: any): Promise<AggregationLock> {
  let lock = await db.collection('eitje_aggregation_lock').findOne({ _id: 'main' });
  
  if (!lock) {
    const newLock: AggregationLock = {
      _id: 'main',
      isRunning: false,
      lastCompleted: null,
    };
    await db.collection('eitje_aggregation_lock').insertOne(newLock);
    return newLock;
  }
  
  return lock as AggregationLock;
}

/**
 * Acquire aggregation lock (returns true if acquired, false if already running)
 */
async function acquireAggregationLock(db: any): Promise<boolean> {
  const result = await db.collection('eitje_aggregation_lock').updateOne(
    { _id: 'main', isRunning: false },
    {
      $set: {
        isRunning: true,
        startedAt: new Date(),
        lastError: null,
      },
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Release aggregation lock
 */
async function releaseAggregationLock(
  db: any,
  success: boolean,
  error?: string
): Promise<void> {
  const update: any = {
    isRunning: false,
    startedAt: null,
  };
  
  if (success) {
    update.lastCompleted = new Date();
    update.lastError = null;
  } else {
    update.lastError = error || 'Unknown error';
  }
  
  await db.collection('eitje_aggregation_lock').updateOne(
    { _id: 'main' },
    { $set: update }
  );
}

/**
 * Trigger aggregation if data has changed since last update
 * Returns true if aggregation was triggered, false if skipped
 */
export async function triggerAggregationIfChanged(
  force: boolean = false,
  aggregationTypes: AggregationType[] = ['time_registration', 'planning_registration', 'team', 'location', 'user', 'event'],
  periods: AggregationPeriod[] = ['day', 'week', 'month', 'year']
): Promise<{
  triggered: boolean;
  reason: string;
  results?: any;
  error?: string;
}> {
  const db = await getDatabase();
  
  try {
    // Check if aggregation is already running
    const lock = await getAggregationLock(db);
    
    if (lock.isRunning && !force) {
      console.log('[Aggregation Trigger] Already running, skipping...');
      return {
        triggered: false,
        reason: 'Aggregation already running',
      };
    }
    
    // Try to acquire lock
    const acquired = await acquireAggregationLock(db);
    if (!acquired && !force) {
      console.log('[Aggregation Trigger] Could not acquire lock, skipping...');
      return {
        triggered: false,
        reason: 'Could not acquire lock (another process is running)',
      };
    }
    
    try {
      // Check if data has changed
      const lastAggregationTime = lock.lastCompleted ? new Date(lock.lastCompleted) : null;
      const { changed, newRecordsCount, lastRecordTime } = await hasDataChangedSinceLastAggregation(
        db,
        lastAggregationTime
      );
      
      if (!changed && !force) {
        console.log('[Aggregation Trigger] No data changes detected since last aggregation, skipping...');
        await releaseAggregationLock(db, true);
        return {
          triggered: false,
          reason: `No data changes detected (last aggregation: ${lastAggregationTime?.toISOString() || 'never'})`,
        };
      }
      
      console.log(
        `[Aggregation Trigger] Data changed detected: ${newRecordsCount} new/updated records since ${lastAggregationTime?.toISOString() || 'never'}. Triggering aggregation...`
      );
      
      // Determine date range for aggregation
      // If we have a last aggregation time, only aggregate new data
      // Otherwise, aggregate all data
      let startDate: Date | undefined = undefined;
      let endDate: Date | undefined = undefined;
      
      if (lastAggregationTime && !force) {
        // Only aggregate data from last aggregation time onwards
        startDate = lastAggregationTime;
        endDate = lastRecordTime || new Date();
      }
      
      // Run aggregations
      const aggregationResults = await aggregateAll(
        startDate,
        endDate,
        aggregationTypes,
        periods
      );
      
      // Sync unified collections
      const unifiedResults = await syncAllUnified();
      
      // Release lock with success
      await releaseAggregationLock(db, true);
      
      const totalProcessed = aggregationResults.reduce((sum, r) => sum + r.recordsProcessed, 0);
      const totalCreated = aggregationResults.reduce((sum, r) => sum + r.recordsCreated, 0);
      const totalUpdated = aggregationResults.reduce((sum, r) => sum + r.recordsUpdated, 0);
      
      console.log(
        `[Aggregation Trigger] Completed successfully: ${totalProcessed} processed, ${totalCreated} created, ${totalUpdated} updated`
      );
      
      return {
        triggered: true,
        reason: force ? 'Forced aggregation' : `Data changed: ${newRecordsCount} new/updated records`,
        results: {
          aggregations: {
            totalProcessed,
            totalCreated,
            totalUpdated,
            details: aggregationResults,
          },
          unified: unifiedResults,
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error('[Aggregation Trigger] Error during aggregation:', errorMessage);
      await releaseAggregationLock(db, false, errorMessage);
      
      return {
        triggered: true,
        reason: 'Aggregation triggered but failed',
        error: errorMessage,
      };
    }
  } catch (error: any) {
    console.error('[Aggregation Trigger] Fatal error:', error);
    return {
      triggered: false,
      reason: 'Fatal error',
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Get aggregation status
 */
export async function getAggregationStatus(): Promise<{
  isRunning: boolean;
  lastCompleted: Date | null;
  lastError: string | null;
  startedAt: Date | null;
}> {
  const db = await getDatabase();
  const lock = await getAggregationLock(db);
  
  return {
    isRunning: lock.isRunning || false,
    lastCompleted: lock.lastCompleted ? new Date(lock.lastCompleted) : null,
    lastError: lock.lastError || null,
    startedAt: lock.startedAt ? new Date(lock.startedAt) : null,
  };
}
