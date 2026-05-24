import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'
import type { OpsScanContext } from '../scanContext'

export function detectIntegrityNotifications(ctx: OpsScanContext): OpsNotificationDto[] {
  const items: OpsNotificationDto[] = []

  for (const row of ctx.inboxUnmapped) {
    const bd = String(row.business_date ?? '')
    items.push(
      buildNotificationItem({
        kind: 'unmapped_basis_location',
        businessDate: bd || 'unknown',
        locationId: 'unmapped',
        locationName: String(row.location ?? 'Unknown'),
        message: `Basis inbox row has no location_id — parser could not match unified_location ("${row.location}").`,
        fixHint: `Add alias to unified_location for "${row.location}"; re-process inbox attachment.`,
        severity: 'warning',
        meta: { cronHour: row.cron_hour },
      }),
    )
  }

  return items
}
