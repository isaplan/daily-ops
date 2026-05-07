/**
 * @registry-id: gmailConnectionStatusAPI
 * @created: 2026-05-03T16:45:00.000Z
 * @last-modified: 2026-05-03T16:45:00.000Z
 * @description: GET /api/inbox/gmail-status — check if Gmail is connected (token exists in DB)
 * @last-fix: [2026-05-03] Initial implementation
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/index.vue
 */

import { isGmailConnected } from '../../services/gmailOAuthService'

export default defineEventHandler(async () => {
  const connected = await isGmailConnected()
  return { success: true, data: { connected } }
})
