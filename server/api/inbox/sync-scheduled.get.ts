/**
 * @registry-id: inboxSyncScheduledAPI
 * @created: 2026-04-20T00:00:00.000Z
 * @last-modified: 2026-04-20T12:00:00.000Z
 * @description: GET /api/inbox/sync-scheduled — Gmail poll for GitHub Actions (same UTC hours as Bork/Eitje +10m via inbox-daily-sync.yml)
 * @last-fix: [2026-04-20] Comment — primary production poll is GitHub cron
 *
 * @exports-to:
 * ✓ .github/workflows/inbox-daily-sync.yml
 */

import { runInboxGmailSync } from '../../services/inboxSyncService'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  const q = getQuery(event)
  if (!secret || String(q.secret ?? '') !== secret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const maxResultsRaw = q.maxResults
  const maxResults =
    typeof maxResultsRaw === 'string' && /^\d+$/.test(maxResultsRaw)
      ? Math.min(500, Math.max(1, parseInt(maxResultsRaw, 10)))
      : 100

  const query = typeof q.query === 'string' && q.query.length > 0 ? q.query : undefined

  try {
    return await runInboxGmailSync({ maxResults, query })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Scheduled sync failed',
    })
  }
})
