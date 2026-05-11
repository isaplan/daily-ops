/**
 * Inbox Gmail scheduler (Nitro task) — **not** Bork/Eitje REST integration crons (`integrations:bork-eitje-*`, `/api/bork/v2/run-scheduled`). This task only lists/fetches Gmail and runs parse pipelines.
 *
 * @registry-id: taskInboxGmailSync
 * @created: 2026-04-21T10:00:00.000Z
 * @last-modified: 2026-05-12T00:00:00.000Z
 * @description: Scheduled Gmail fetch + store + auto-parse via `runInboxGmailSync` (same behavior as POST `/api/inbox/sync` and GET `/api/inbox/sync-scheduled`).
 * @last-fix: [2026-05-12] Metadata: canonical inbox-only schedule, purposes, and target `cron_hour` (pass id) semantics
 *
 * ## Inbox poll schedule (Europe/Amsterdam; requires `TZ=Europe/Amsterdam` on the server)
 * | Wall poll | cron_hour (pass id) | Mail / pipeline role | Purpose |
 * |-----------|---------------------|------------------------|---------|
 * | **08:05** | **8** | Bork basis — **yesterday** daily report | Final yesterday sales from mail; Daily Ops “yesterday”. |
 * | **08:05** | **8** | Eitje — **yesterday** daily hours export | Control mechanism vs Eitje API / other sources. |
 * | **12:05** | **12** | Eitje — **weekly** / current-week hours export | Catch changes to earlier week days; more reliable week-to-date. |
 * | **18:05** | **18** | Bork — intraday daily report (batch ~17:55 in practice) | Support / improve **today** revenue on Daily Ops vs hourly Bork API. |
 * | **23:05** | **23** | Bork — intraday daily report (batch ~22:55 in practice) | Validate / improve hourly Bork data for **today**. |
 *
 * **cron_hour (target contract):** Persist **which inbox poll** produced or owns the row (`8` \| `12` \| `18` \| `23`). For Bork, also use the **hour in the email subject** when present to match the vendor batch; if an email is late or arrives on the next calendar day, still treat it as data for **pass cron_hour *x*** once importers stamp pass id (parsers today may still use subject/receive time — align gradually).
 *
 * Local: set `DISABLE_INBOX_SCHEDULED=1` to skip registering these crons (see `nuxt.config.ts`).
 *
 * @exports-to:
 * ✓ nuxt.config.ts → nitro.scheduledTasks (expressions referencing `inbox:gmail-sync`)
 * ✓ server/services/inboxSyncService.ts → `runInboxGmailSync` implementation shared with UI + HTTP hooks
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
