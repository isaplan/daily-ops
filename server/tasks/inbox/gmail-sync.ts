/**
 * Nitro task: poll Gmail, store new emails, auto-parse.
 * Production schedule: GitHub Actions inbox-daily-sync.yml (not Nitro scheduledTasks). Run manually: npx nuxt task run inbox:gmail-sync
 *
 * @registry-id: taskInboxGmailSync
 * @last-modified: 2026-04-20T12:00:00.000Z
 * @last-fix: [2026-04-20] Docs — polling cadence moved to GitHub; task kept for manual runs
 * @exports-to: (none — no nitro schedule)
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
