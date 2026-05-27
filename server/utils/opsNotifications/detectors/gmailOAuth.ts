/**
 * @description: Critical alert when Gmail OAuth is invalid (inbox cron cannot fetch Basis mail).
 */

import { getGmailConnectionStatus } from '../../../services/gmailOAuthService'
import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'

export async function detectGmailOAuthNotifications(): Promise<OpsNotificationDto[]> {
  const status = await getGmailConnectionStatus()
  if (!status.needsReconnect) return []

  return [
    buildNotificationItem({
      kind: 'gmail_oauth_invalid_grant',
      businessDate: 'system',
      locationId: 'system',
      locationName: 'Gmail inbox',
      message:
        status.lastOAuthError ??
        'Gmail refresh token rejected (invalid_grant). Scheduled inbox polls fail — morning Basis revenue for yesterday will not update.',
      fixHint:
        'Open Daily Ops → Inbox → Connect Gmail (production). After reconnect, run Sync Gmail and rebuild snapshots for affected days.',
      meta: {
        lastSyncFailedAt: status.lastSyncFailedAt,
        lastSyncOkAt: status.lastSyncOkAt,
        hasRefreshToken: status.hasRefreshToken,
      },
    }),
  ]
}
