import { pickBasisReportByCronPriority } from '../../inbox/basis-report-mapper'
import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'
import { REV_EPS, snapKey, type OpsScanContext } from '../scanContext'

export function detectSnapshotGapNotifications(ctx: OpsScanContext): OpsNotificationDto[] {
  const items: OpsNotificationDto[] = []

  for (const [key, borkEx] of ctx.borkExByKey) {
    if (borkEx <= REV_EPS) continue
    const [businessDate, locationId] = key.split(':::') as [string, string]
    const name = ctx.locName.get(locationId) ?? locationId
    const snap = ctx.revenueByKey.get(key)

    if (!snap) {
      items.push(
        buildNotificationItem({
          kind: 'missing_revenue_snapshot',
          businessDate,
          locationId,
          locationName: name,
          message: `Bork API has €${borkEx.toFixed(0)} ex for ${businessDate} but no revenue snapshot — Daily Ops GET cannot show this day (ADR-004).`,
          fixHint: `pnpm snapshots:backfill -- --start ${businessDate} --end ${businessDate} --location ${locationId}`,
          meta: { borkEx },
        }),
      )
      continue
    }
    if (snap.ex <= REV_EPS) {
      items.push(
        buildNotificationItem({
          kind: 'revenue_snapshot_empty',
          businessDate,
          locationId,
          locationName: name,
          message: `Revenue snapshot headline is €0 but Bork API has €${borkEx.toFixed(0)} ex.`,
          fixHint: `pnpm snapshots:backfill:infected -- --start ${businessDate} --end ${businessDate} --location ${locationId}`,
          meta: { borkEx, snapEx: snap.ex },
        }),
      )
    }
  }

  for (const [key] of ctx.eitjeHoursByKey) {
    if (ctx.laborKeys.has(key)) continue
    const [businessDate, locationId] = key.split(':::') as [string, string]
    const hours = ctx.eitjeHoursByKey.get(key) ?? 0
    items.push(
      buildNotificationItem({
        kind: 'missing_labor_snapshot',
        businessDate,
        locationId,
        locationName: ctx.locName.get(locationId) ?? locationId,
        message: `Eitje aggregation has ${hours.toFixed(1)}h for ${businessDate} but no labor snapshot section.`,
        fixHint: `pnpm snapshots:backfill -- --start ${businessDate} --end ${businessDate} --location ${locationId}`,
        meta: { hours },
      }),
    )
  }

  for (const key of ctx.revenueByKey.keys()) {
    if (ctx.masterKeys.has(key)) continue
    const [businessDate, locationId] = key.split(':::') as [string, string]
    items.push(
      buildNotificationItem({
        kind: 'missing_master_snapshot',
        businessDate,
        locationId,
        locationName: ctx.locName.get(locationId) ?? locationId,
        message: `Revenue snapshot exists without a matching daily_ops_snapshot master document.`,
        fixHint: `pnpm snapshots:backfill -- --start ${businessDate} --end ${businessDate} --location ${locationId}`,
      }),
    )
  }

  for (const [key, rows] of ctx.inboxByKey) {
    const correct = pickBasisReportByCronPriority(rows)
    if (!correct || Number(correct.final_revenue_ex_vat ?? 0) <= REV_EPS) continue
    const snap = ctx.revenueByKey.get(key)
    if (!snap) continue
    const correctEx = Number(correct.final_revenue_ex_vat ?? 0)
    if (Math.abs(snap.ex - correctEx) <= REV_EPS) continue
    const [businessDate, locationId] = key.split(':::') as [string, string]
    items.push(
      buildNotificationItem({
        kind: 'revenue_snapshot_stale_basis',
        businessDate,
        locationId,
        locationName: ctx.locName.get(locationId) ?? locationId,
        message: `Snapshot €${snap.ex.toFixed(0)} ex ≠ morning Basis cron ${correct.cron_hour} (€${correctEx.toFixed(0)} ex). Likely wrong cron pick at build time.`,
        fixHint: `pnpm snapshots:backfill:infected -- --start ${businessDate} --end ${businessDate} --location ${locationId}`,
        meta: { snapEx: snap.ex, correctEx, cronHour: correct.cron_hour },
      }),
    )
  }

  return items
}
