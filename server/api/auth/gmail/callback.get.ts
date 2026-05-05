/**
 * @registry-id: gmailAuthCallbackAPI
 * @created: 2026-05-02T15:00:00.000Z
 * @last-modified: 2026-05-03T20:12:00.000Z
 * @description: GET /api/auth/gmail/callback — OAuth callback from Google, store refresh token
 * @last-fix: [2026-05-03] Use dynamic redirect_uri from env
 *
 * @exports-to:
 * ✓ server/services/gmailOAuthService.ts
 */

import { google } from 'googleapis'
import { getGmailRedirectUri } from '../../../utils/gmailRedirectUri'
import { saveGmailRefreshToken } from '../../../services/gmailOAuthService'

export default defineEventHandler(async (event) => {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return sendRedirect(event, '/daily-ops/inbox?error=server_misconfigured')
  }

  const query = getQuery(event)
  const code = query.code as string
  const error = query.error as string

  if (error) {
    console.log('[callback] OAuth error:', error)
    return sendRedirect(event, `/daily-ops/inbox?error=${error}`)
  }

  if (!code) {
    console.log('[callback] No code in query')
    return sendRedirect(event, '/daily-ops/inbox?error=missing_code')
  }

  try {
    const redirectUri = getGmailRedirectUri()
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    console.log('[callback] Exchanging code with redirectUri:', redirectUri)
    const { tokens } = await oauth2Client.getToken(code)

    console.log('[callback] Received tokens:', {
      hasRefresh: !!tokens.refresh_token,
      hasAccess: !!tokens.access_token,
      refreshPrefix: tokens.refresh_token ? tokens.refresh_token.slice(0, 20) : 'none',
    })

    if (!tokens.refresh_token) {
      console.log('[callback] No refresh_token in response')
      return sendRedirect(
        event,
        '/daily-ops/inbox?error=no_refresh_token&hint=use_prompt_consent',
      )
    }

    await saveGmailRefreshToken(tokens.refresh_token)
    console.log('[callback] Token saved to DB')

    return sendRedirect(event, '/daily-ops/inbox?connected=gmail')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[callback] Error:', message)
    return sendRedirect(
      event,
      `/daily-ops/inbox?error=oauth_failed&message=${encodeURIComponent(message)}`,
    )
  }
})
