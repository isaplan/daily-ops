/**
 * @registry-id: dailyOpsEnsureCollections
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Ensure Daily Ops raw and snapshot collections exist before first write
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts
 *   ✓ app/api/cron/daily-aggregation/route.ts
 *   ✓ app/lib/services/sync/emailSnapshotCollector.ts
 *   ✓ app/lib/services/sync/apiSnapshotCollector.ts
 */

import { getDatabase } from '@/lib/mongodb/v2-connection';

export const DAILY_OPS_RAW_COLLECTIONS = [
  'test-eitje-hours',
  'test-eitje-contracts',
  'test-eitje-finance-summary',
  'test-bork-sales-unified',
  'test-bork-basis-rapport',
] as const;

export const DAILY_OPS_SNAPSHOT_COLLECTIONS = [
  'snapshots_email',
  'snapshots_api',
  'snapshot_reconciliation',
  'bork_reconciliation',
] as const;

export const DAILY_OPS_AGGREGATED_COLLECTION = 'daily_ops_dashboard_aggregated';

const ALL_DAILY_OPS_COLLECTIONS = [
  ...DAILY_OPS_RAW_COLLECTIONS,
  ...DAILY_OPS_SNAPSHOT_COLLECTIONS,
  DAILY_OPS_AGGREGATED_COLLECTION,
] as const;

/**
 * Create each Daily Ops collection if it does not exist. Idempotent.
 */
export async function ensureDailyOpsCollections(): Promise<void> {
  const db = await getDatabase();
  await Promise.all(
    ALL_DAILY_OPS_COLLECTIONS.map((name) =>
      db.createCollection(name).catch(() => {
        // Collection already exists
      })
    )
  );
}
