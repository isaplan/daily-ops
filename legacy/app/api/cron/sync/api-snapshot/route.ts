/**
 * @registry-id: apiSnapshotCronRoute
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Cron hourly (00-23) - collect API snapshot
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ Vercel cron / external scheduler => POST /api/cron/sync/api-snapshot
 */

import { NextResponse } from 'next/server';
import { collectAPISnapshot } from '@/lib/services/sync/apiSnapshotCollector';

export const runtime = 'nodejs';

export async function POST() {
  const now = new Date();
  const hour = now.getHours();
  const result = await collectAPISnapshot(hour);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    hour,
    snapshotId: result.snapshotId,
    borkTicketsFetched: result.borkTicketsFetched ?? 0,
  });
}
