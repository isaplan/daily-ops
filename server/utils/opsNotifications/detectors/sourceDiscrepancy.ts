/**
 * @last-modified: 2026-05-24T15:45:00.000Z
 * @last-fix: [2026-05-24] Skip missing_inbox when intraday rows exist; downgrade gap when snapshot matches Basis
 */
import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'
import {
  gapIsSignificant,
  morningFinalInboxEx,
  REV_EPS,
  snapKey,
  type OpsScanContext,
} from '../scanContext'

export function detectSourceDiscrepancyNotifications(ctx: OpsScanContext): OpsNotificationDto[] {
  const items: OpsNotificationDto[] = []
  const keys = new Set([...ctx.borkExByKey.keys(), ...ctx.inboxByKey.keys()])

  for (const key of keys) {
    const [businessDate, locationId] = key.split(':::') as [string, string]
    if (businessDate === ctx.openBusinessDate) continue
    const name = ctx.locName.get(locationId) ?? locationId
    const borkEx = ctx.borkExByKey.get(key) ?? 0
    const inboxRows = ctx.inboxByKey.get(key) ?? []
    const inboxEx = morningFinalInboxEx(inboxRows)

    if (borkEx > REV_EPS && inboxEx <= REV_EPS) {
      // Intraday-only rows → cronPipeline (inbox_only_intraday_partial / inbox_morning_final_missing)
      if (inboxRows.length > 0) continue
      items.push(
        buildNotificationItem({
          kind: 'missing_inbox_when_bork_sales',
          businessDate,
          locationId,
          locationName: name,
          message: `Bork API €${borkEx.toFixed(0)} ex but no morning Basis inbox row (cron 7/8) for this business_date.`,
          fixHint: `Check inbox sync (08:05 Amsterdam) and Gmail; then POST /api/inbox/sync or wait for cron. Rebuild: pnpm snapshots:backfill -- --start ${businessDate} --end ${businessDate} --location ${locationId}`,
          meta: { borkEx, inboxEx },
        }),
      )
      continue
    }

    if (inboxEx > REV_EPS && borkEx <= REV_EPS) {
      items.push(
        buildNotificationItem({
          kind: 'missing_bork_when_inbox_final',
          businessDate,
          locationId,
          locationName: name,
          message: `Morning Basis €${inboxEx.toFixed(0)} ex but Bork API day total is €${borkEx.toFixed(0)} ex — sync/aggregation may have failed.`,
          fixHint: `Run Bork daily sync for ${businessDate}; then pnpm bork:rebuild:v2 if needed.`,
          meta: { borkEx, inboxEx },
        }),
      )
      continue
    }

    if (gapIsSignificant(borkEx, inboxEx)) {
      const delta = inboxEx - borkEx
      const snap = ctx.revenueByKey.get(key)
      const snapMatchesInbox =
        snap != null && inboxEx > REV_EPS && Math.abs(snap.ex - inboxEx) <= REV_EPS
      items.push(
        buildNotificationItem({
          kind: 'bork_inbox_revenue_gap',
          businessDate,
          locationId,
          locationName: name,
          severity: snapMatchesInbox ? 'warning' : 'critical',
          message: snapMatchesInbox
            ? `Warm Bork tier ≠ Basis (snapshot OK): Bork €${borkEx.toFixed(0)} ex vs morning Basis €${inboxEx.toFixed(0)} ex (Δ €${delta.toFixed(0)}). UI uses snapshot.`
            : `Large mismatch: Bork API €${borkEx.toFixed(0)} ex vs morning Basis €${inboxEx.toFixed(0)} ex (Δ €${delta.toFixed(0)}). Snapshot may be wrong.`,
          fixHint: snapMatchesInbox
            ? `pnpm bork:rebuild:v2 with BORK_V2_START=${businessDate} BORK_V2_END=${businessDate}; compare Datalab vs Trivec if gap persists.`
            : `Compare Datalab/Bork vs Trivec for ${businessDate}. Then pnpm snapshots:backfill:infected -- --start ${businessDate} --end ${businessDate} --location ${locationId}`,
          meta: { borkEx, inboxEx, deltaEx: delta, snapEx: snap?.ex },
        }),
      )
    }
  }

  return items
}
