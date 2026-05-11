/**
 * Nitro task: poll Gmail, store new emails, auto-parse.
 * Production schedule: 3×/day in nuxt.config — 08:05, 18:05, 23:05 Europe/Amsterdam (TZ env). Catches Eitje ~08:00 daily uren and ~07:55 optional “current week” export in the morning slot. Local: DISABLE_INBOX_SCHEDULED=1 to skip.
 *
 * @registry-id: taskInboxGmailSync
 * @last-modified: 2026-04-21T10:00:00.000Z
 * @last-fix: [2026-05-11] Doc: morning poll covers Eitje weekly + daily hours mail
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

console.log('[inbox/gmail-sync.ts] Module loaded - this should print on Nitro startup')

import { runInboxGmailSync } from '../../services/inboxSyncService'

export default defineTask({
  meta: {
    name: 'inbox:gmail-sync',
    description: 'Scheduled Gmail inbox fetch (same as POST /api/inbox/sync)',
  },
  async run() {
    console.log(
      '[inbox:gmail-sync] SCHEDULED TASK TRIGGERED AT',
      new Date().toISOString(),
      '(local clock:',
      new Date().toLocaleString('en-US', { timeZone: 'UTC' }),
      'UTC)'
    )

    const maxResults = parseInt(process.env.INBOX_SYNC_MAX_RESULTS || '100', 10)
    const capped = Number.isFinite(maxResults) ? Math.min(500, Math.max(1, maxResults)) : 100
    try {
      console.log('[inbox:gmail-sync] Running sync with maxResults=' + capped)
      const result = await runInboxGmailSync({ maxResults: capped })
      console.log('[inbox:gmail-sync] SUCCESS:', result.data)
      return { result: result.data }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[inbox:gmail-sync] ERROR:', message, e)
      return { result: { ok: false, error: message } }
    }
  },
})
