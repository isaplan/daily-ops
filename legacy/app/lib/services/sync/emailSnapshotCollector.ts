/**
 * @registry-id: emailSnapshotCollector
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Collect email snapshots at 08:00, 15:00, 19:00, 23:00 for reconciliation
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/api/cron/sync/email-snapshot/route.ts
 */

import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ensureDailyOpsCollections } from '@/lib/daily-ops/ensure-collections';

export type SnapshotTime = '08:00' | '15:00' | '19:00' | '23:00';

export interface EitjeFinanceSnapshot {
  filename?: string;
  received_at: string;
  data: Array<{
    location: string;
    revenue?: number;
    labor_cost?: number;
    labor_cost_percentage?: number;
    hours?: number;
  }>;
}

export interface BorkBasisSnapshot {
  filename?: string;
  received_at: string;
  data: Record<string, unknown>[];
}

export interface EmailSnapshotPayload {
  timestamp: Date;
  snapshotTime: SnapshotTime;
  type: 'email_snapshot';
  eitjeFinanceCsv?: EitjeFinanceSnapshot;
  borkBasisReportCsv?: BorkBasisSnapshot;
  snapshot_metadata: {
    intended_time: SnapshotTime;
    actual_received_time: Date;
    delay_minutes: number;
    source: 'email';
  };
}

export interface CollectEmailSnapshotResult {
  success: boolean;
  snapshotId?: string;
  snapshotTime: SnapshotTime;
  error?: string;
}

/**
 * Collect and store email snapshot. Call at 08:00, 15:00, 19:00, 23:00.
 * Pass optional pre-fetched CSV data when available from inbox.
 */
export async function collectEmailSnapshot(
  snapshotTime: SnapshotTime,
  payload?: Partial<EmailSnapshotPayload>
): Promise<CollectEmailSnapshotResult> {
  try {
    await ensureDailyOpsCollections();
    const db = await getDatabase();

    const now = new Date();
    const doc: EmailSnapshotPayload = {
      timestamp: payload?.timestamp ?? now,
      snapshotTime,
      type: 'email_snapshot',
      eitjeFinanceCsv: payload?.eitjeFinanceCsv,
      borkBasisReportCsv: payload?.borkBasisReportCsv,
      snapshot_metadata: payload?.snapshot_metadata ?? {
        intended_time: snapshotTime,
        actual_received_time: now,
        delay_minutes: 0,
        source: 'email',
      },
    };

    const result = await db.collection('snapshots_email').insertOne(doc);
    return {
      success: true,
      snapshotId: result.insertedId.toString(),
      snapshotTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, snapshotTime, error: message };
  }
}
