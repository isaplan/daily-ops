/**
 * @registry-id: gmailAuthAuthorizeAPI
 * @created: 2026-05-02T15:00:00.000Z
 * @last-modified: 2026-05-03T20:12:00.000Z
 * @description: GET /api/auth/gmail/authorize — redirect to Google OAuth consent
 * @last-fix: [2026-05-03] Use dynamic redirect_uri from env
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/index.vue (UI button)
 */

import { google } from 'googleapis'
import { getGmailRedirectUri } from '../../../utils/gmailRedirectUri'

export default defineEventHandler(async (event) => {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Gmail OAuth credentials not configured on server',
    })
  }

  const redirectUri = getGmailRedirectUri()

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent',
  })

  console.log('[authorize] Redirecting to Google with redirectUri:', redirectUri)
  return sendRedirect(event, authUrl)
})
