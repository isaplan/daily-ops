/**
 * Nitro task: poll Gmail, store new emails, auto-parse.
 * Scheduled via nuxt.config nitro.scheduledTasks (node_server / DO App worker).
 *
 * @registry-id: taskInboxGmailSync
 * @last-modified: 2026-04-20T00:00:00.000Z
 * @last-fix: [2026-04-20] Catch run() errors so scheduled task does not throw (Mongo/network offline)
 * @exports-to: nuxt.config scheduledTasks → inbox:gmail-sync
 */

import { runInboxGmailSync } from '../../services/inboxSyncService'

export default defineTask({
  meta: {
    name: 'inbox:gmail-sync',
    description: 'Scheduled Gmail inbox fetch (same as POST /api/inbox/sync)',
  },
  async run() {
    const maxResults = parseInt(process.env.INBOX_SYNC_MAX_RESULTS || '100', 10)
    const capped = Number.isFinite(maxResults) ? Math.min(500, Math.max(1, maxResults)) : 100
    try {
      const result = await runInboxGmailSync({ maxResults: capped })
      return { result: result.data }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { result: { ok: false, error: message } }
    }
  },
})
