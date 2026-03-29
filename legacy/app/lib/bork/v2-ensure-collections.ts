/**
 * Ensure Bork MongoDB collections exist before first write.
 * MongoDB creates collections on first insert; explicit createCollection ensures they exist
 * even when the first sync returns no data (so the collection appears in the DB).
 *
 * @exports-to:
 *   ✓ app/lib/services/salesSyncService.ts
 *   ✓ app/lib/bork/v2-master-sync-service.ts
 *   ✓ app/lib/bork/v2-cron-manager.ts (bork_cron_jobs)
 */

import { getDatabase } from '@/lib/mongodb/v2-connection';

export const BORK_COLLECTIONS = [
  'bork_raw_data',
  'bork_product_groups',
  'bork_payment_methods',
  'bork_cost_centers',
  'bork_cron_jobs',
  'test-bork-sales-unified',
  'bork_reconciliation',
] as const;

/**
 * Create each Bork collection if it does not exist. Idempotent; safe to call on every sync.
 */
export async function ensureBorkCollections(): Promise<void> {
  const db = await getDatabase();
  await Promise.all(
    BORK_COLLECTIONS.map((name) =>
      db.createCollection(name).catch(() => {
        // Collection already exists (MongoServerError 48 or similar)
      })
    )
  );
}
