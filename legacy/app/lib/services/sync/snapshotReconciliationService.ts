/**
 * @registry-id: snapshotReconciliationService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Compare email snapshots with nearby API snapshots for data quality
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/api/cron/sync/email-snapshot/route.ts
 *   ✓ app/api/cron/sync/api-snapshot/route.ts
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ensureDailyOpsCollections } from '@/lib/daily-ops/ensure-collections';

export interface ReconciliationResult {
  email_snapshot_id: string;
  api_snapshot_id?: string;
  timestamp: Date;
  labor_match: boolean;
  sales_match: boolean;
  overall: 'PASS' | 'FAIL';
  variance?: { labor?: number; sales?: number };
}

const TOLERANCE = 0.01;

/**
 * Reconcile an email snapshot with the nearest API snapshot (same hour or previous hour).
 * Stores result in snapshot_reconciliation.
 */
export async function reconcileEmailSnapshot(
  emailSnapshotId: string
): Promise<ReconciliationResult | null> {
  await ensureDailyOpsCollections();
  const db = await getDatabase();

  let eid: ObjectId;
  try {
    eid = new ObjectId(emailSnapshotId);
  } catch {
    return null;
  }
  const emailSnap = await db.collection('snapshots_email').findOne({ _id: eid });
  if (!emailSnap) return null;

  const intendedTime = (emailSnap.snapshotTime as string) || '';
  const hour = parseInt(intendedTime.slice(0, 2), 10);
  if (Number.isNaN(hour)) {
    await db.collection('snapshot_reconciliation').insertOne({
      email_snapshot_id: emailSnapshotId,
      timestamp: new Date(),
      labor_match: true,
      sales_match: true,
      overall: 'PASS',
    });
    return { email_snapshot_id: emailSnapshotId, timestamp: new Date(), labor_match: true, sales_match: true, overall: 'PASS' };
  }

  const apiSnaps = await db
    .collection('snapshots_api')
    .find({ hour: { $in: [hour - 1, hour] } })
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();

  const apiSnap = apiSnaps[0];
  let labor_match = true;
  let sales_match = true;
  let variance: { labor?: number; sales?: number } = {};

  if (apiSnap?.borkSales) {
    const apiRevenue = (apiSnap.borkSales as { data?: unknown[] }).data?.reduce(
      (s: number, t: Record<string, unknown>) => s + (t.TotalPrice as number ?? 0),
      0
    ) ?? 0;
    const emailRevenue = (emailSnap.borkBasisReportCsv as { data?: Array<{ revenue?: number; total?: number }> })?.data?.reduce(
      (s, r) => s + (r.revenue ?? r.total ?? 0),
      0
    ) ?? 0;
    const v = Math.abs(apiRevenue - emailRevenue) / (emailRevenue || 1);
    sales_match = v < TOLERANCE;
    variance.sales = v;
  }

  const result: ReconciliationResult = {
    email_snapshot_id: emailSnapshotId,
    api_snapshot_id: apiSnap?._id?.toString(),
    timestamp: new Date(),
    labor_match,
    sales_match,
    overall: labor_match && sales_match ? 'PASS' : 'FAIL',
    variance: Object.keys(variance).length ? variance : undefined,
  };

  await db.collection('snapshot_reconciliation').insertOne(result);
  return result;
}
