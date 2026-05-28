/**
 * @registry-id: taskOpsNotificationsAutoRetry
 * @created: 2026-05-28T00:00:00.000Z
 * @description: Optional auto-retry for selected ops alerts with cooldown + lock.
 * @last-fix: [2026-05-28] Add cron-safe auto-fix loop (opt-in only).
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
