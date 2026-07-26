/**
 * @registry-id: taskOpsNotificationsAutoRetry
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-07-26T17:50:00.000Z
 * @description: Self-heal selected ops alerts (cooldown + lock). On by default in production.
 * @last-fix: [2026-07-26] Enabled by default (DISABLE_OPS_NOTIFICATION_AUTO_RETRY=1 to opt out)
 *   Prior: [2026-05-28] Add cron-safe auto-fix loop (opt-in only).
 *
 * @exports-to:
 * ✓ nuxt.config.ts -> nitro.scheduledTasks (ops-notifications:auto-retry)
 */

import { getDb } from '../../../utils/db'
import { runOpsNotificationAutoRetry } from '../../../utils/opsNotifications/autoRetry'

export default defineTask({
  meta: {
    name: 'ops-notifications:auto-retry',
    description: 'Auto-retry selected ops notifications (cooldown + lock)',
  },
  async run() {
    try {
      const db = await getDb()
      const result = await runOpsNotificationAutoRetry(db)
      return { result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { result: { ok: false, message } }
    }
  },
})
