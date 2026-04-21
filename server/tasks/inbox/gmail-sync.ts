/**
 * Nitro task: poll Gmail, store new emails, auto-parse.
 * Production schedule: Nitro `0 8 * * *` UTC (~10:00 Amsterdam CEST) in nuxt.config. Local: DISABLE_INBOX_SCHEDULED=1 to skip.
 *
 * @registry-id: taskInboxGmailSync
 * @last-modified: 2026-04-21T10:00:00.000Z
 * @last-fix: [2026-04-21] Single daily DO-side poll; GitHub inbox workflow manual-only
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
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
