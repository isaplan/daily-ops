/**
 * Nitro task: poll Gmail, store new emails, auto-parse.
 * Production schedule: 3×/day in nuxt.config — `5 6`, `5 16`, `5 21` **UTC** = 08:05 / 18:05 / 23:05 Europe/Amsterdam during CEST (typical DO host). Local: DISABLE_INBOX_SCHEDULED=1 to skip.
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
