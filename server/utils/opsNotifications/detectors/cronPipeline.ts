import { calculateBasisCronPriority } from '../../inbox/basis-report-mapper'
import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'
import {
  hasMorningFinalInbox,
  REV_EPS,
  snapKey,
  type OpsScanContext,
} from '../scanContext'

export function detectCronPipelineNotifications(ctx: OpsScanContext): OpsNotificationDto[] {
  const items: OpsNotificationDto[] = []

  for (const [key, borkEx] of ctx.borkExByKey) {
    if (borkEx <= REV_EPS) continue
    const [businessDate, locationId] = key.split(':::') as [string, string]
    if (businessDate === ctx.openBusinessDate) continue
    const name = ctx.locName.get(locationId) ?? locationId
    const rows = ctx.inboxByKey.get(key) ?? []

    if (rows.length === 0) continue

    if (!hasMorningFinalInbox(rows)) {
      const crons = [...new Set(rows.map((r) => r.cron_hour).filter((h) => h != null))]
      const hasIntradayOnly = crons.every((h) => calculateBasisCronPriority(h) < 3)
      if (hasIntradayOnly && crons.length > 0) {
        items.push(
          buildNotificationItem({
            kind: 'inbox_only_intraday_partial',
            businessDate,
            locationId,
            locationName: name,
            message: `Only intraday Basis emails (cron ${crons.join(', ')}) — missing morning final (cron 7/8). Headline revenue may be wrong in snapshots.`,
            fixHint: `Ensure 08:05 inbox cron ran; check Gmail + inbox-bork-basis-report. Then pnpm snapshots:backfill:infected`,
            meta: { crons, borkEx },
          }),
        )
      } else {
        items.push(
          buildNotificationItem({
            kind: 'inbox_morning_final_missing',
            businessDate,
            locationId,
            locationName: name,
            message: `Bork has sales but no morning "Yesterday" Basis report was stored for this business_date.`,
            fixHint: `Run inbox sync after 08:05 Amsterdam; verify cron_hour 7 or 8 row exists.`,
            meta: { borkEx, crons },
          }),
        )
      }
    }
  }

  for (const [key, hours] of ctx.eitjeHoursByKey) {
    if (ctx.eitjeInboxDays.has(key)) continue
    const [businessDate, locationId] = key.split(':::') as [string, string]
    if (businessDate === ctx.openBusinessDate) continue
    items.push(
      buildNotificationItem({
        kind: 'eitje_hours_inbox_missing',
        businessDate,
        locationId,
        locationName: ctx.locName.get(locationId) ?? locationId,
        message: `Eitje aggregation has ${hours.toFixed(1)}h but no inbox-eitje-hours row for control/compare.`,
        fixHint: `Check 08:05 Eitje inbox export + /api/inbox/sync; verify inbox-eitje-hours for ${businessDate}.`,
        meta: { hours },
      }),
    )
  }

  return items
}
