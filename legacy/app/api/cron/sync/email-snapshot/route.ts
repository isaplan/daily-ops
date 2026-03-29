/**
 * @registry-id: emailSnapshotCronRoute
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Cron at 08:00, 15:00, 19:00, 23:00 - collect email snapshot and reconcile
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ Vercel cron / external scheduler => POST /api/cron/sync/email-snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { collectEmailSnapshot, type SnapshotTime } from '@/lib/services/sync/emailSnapshotCollector';
import { reconcileEmailSnapshot } from '@/lib/services/sync/snapshotReconciliationService';

export const runtime = 'nodejs';

const VALID_HOURS = [8, 15, 19, 23];

export async function POST(request: NextRequest) {
  const now = new Date();
  const hour = now.getHours();
  if (!VALID_HOURS.includes(hour)) {
    return NextResponse.json({
      success: false,
      message: `Email snapshot not scheduled for hour ${hour}`,
    });
  }

  const snapshotTime: SnapshotTime = `${String(hour).padStart(2, '0')}:00` as SnapshotTime;
  const collectResult = await collectEmailSnapshot(snapshotTime);

  if (!collectResult.success) {
    return NextResponse.json(
      { success: false, error: collectResult.error },
      { status: 500 }
    );
  }

  let reconciliation = null;
  if (collectResult.snapshotId) {
    reconciliation = await reconcileEmailSnapshot(collectResult.snapshotId);
  }

  return NextResponse.json({
    success: true,
    snapshotTime,
    snapshotId: collectResult.snapshotId,
    reconciliation: reconciliation?.overall ?? null,
  });
}
