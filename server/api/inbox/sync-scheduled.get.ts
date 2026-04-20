/**
 * @registry-id: inboxSyncScheduledAPI
 * @created: 2026-04-20T00:00:00.000Z
 * @last-modified: 2026-04-20T22:15:00.000Z
 * @description: GET /api/inbox/sync-scheduled — Gmail poll for GitHub Actions (same UTC hours as Bork/Eitje +10m via inbox-daily-sync.yml)
 * @last-fix: [2026-04-20] Map invalid_grant → 401 + redirect/client hints (same as watch/renew)
 *
 * @exports-to:
 * ✓ .github/workflows/inbox-daily-sync.yml
 */

import { runInboxGmailSync } from '../../services/inboxSyncService'
import { getGmailOAuthErrorMessage, isInvalidGrantError } from '../../utils/gmailOAuthError'

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
    if (isInvalidGrantError(error)) {
      const clientId = process.env.GMAIL_CLIENT_ID ?? ''
      const clientIdHint =
        clientId.length > 14 ? `${clientId.slice(0, 8)}…${clientId.slice(-6)}` : clientId || '(unset)'
      throw createError({
        statusCode: 401,
        statusMessage:
          'Gmail OAuth invalid_grant: refresh token rejected. Match GMAIL_REDIRECT_URI and OAuth client to the values used when GMAIL_REFRESH_TOKEN was issued; re-authorize and update DigitalOcean env.',
        data: {
          google: getGmailOAuthErrorMessage(error),
          gmailRedirectUri: process.env.GMAIL_REDIRECT_URI ?? '(unset)',
          gmailClientIdHint: clientIdHint,
          hint: 'Update GMAIL_REFRESH_TOKEN on DigitalOcean after OAuth with the same client + redirect URI.',
        },
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Scheduled sync failed',
    })
  }
})
