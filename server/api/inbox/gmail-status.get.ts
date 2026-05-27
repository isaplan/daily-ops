/**
 * @registry-id: gmailConnectionStatusAPI
 * @created: 2026-05-03T16:45:00.000Z
 * @last-modified: 2026-05-27T20:00:00.000Z
 * @description: GET /api/inbox/gmail-status — Gmail OAuth health (token + invalid_grant disconnect).
 * @last-fix: [2026-05-27] Expose needsReconnect when cron invalidates refresh token.
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/index.vue
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getGmailConnectionStatus } from '../../services/gmailOAuthService'

export default defineEventHandler(async () => {
  const status = await getGmailConnectionStatus()
  return {
    success: true,
    data: status,
  }
})
