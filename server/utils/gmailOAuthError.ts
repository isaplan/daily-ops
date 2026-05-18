/**
 * Normalize googleapis / Gaxios OAuth errors for inbox routes.
 *
 * @last-modified: 2026-05-14T12:00:00.000Z
 * @last-fix: [2026-05-14] invalid_grant hints: app redirect (NUXT_PUBLIC_SITE_URL / GMAIL_REDIRECT_URI) — drop Playground-centric copy
 *
 * @exports-to:
 * ✓ server/api/inbox/watch.post.ts
 * ✓ server/api/inbox/watch/renew.get.ts
 * ✓ server/api/inbox/sync-scheduled.get.ts
 */

type GaxiosLike = {
  response?: { data?: { error?: string; error_description?: string } }
  message?: string
}

export function getGmailOAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const g = error as GaxiosLike
    const d = g.response?.data
    if (d?.error || d?.error_description) {
      const parts = [d.error, d.error_description].filter(Boolean)
      return parts.join(': ')
    }
    return error.message
  }
  return 'Unknown error'
}

export function isInvalidGrantError(error: unknown): boolean {
  return getGmailOAuthErrorMessage(error).toLowerCase().includes('invalid_grant')
}

/** Actionable hint when Google rejects the refresh token. */
export function getGmailInvalidGrantHint(redirectUriEnv: string, redirectUriUsed: string): string {
  const envTrim = redirectUriEnv === '(unset)' ? '' : redirectUriEnv.trim()
  const used = (redirectUriUsed || '').trim()
  if (envTrim && used && envTrim !== used) {
    return `GMAIL_REDIRECT_URI in env does not match the redirect URI the server uses for OAuth (${used}). Remove GMAIL_REDIRECT_URI and set NUXT_PUBLIC_SITE_URL to your app origin (https://…), or set GMAIL_REDIRECT_URI to that exact callback URL including /api/auth/gmail/callback, redeploy, then Connect Gmail again.`
  }
  const combined = `${redirectUriEnv}${redirectUriUsed}`.toLowerCase()
  if (combined.includes('localhost') || combined.includes('127.0.0.1')) {
    return 'Redirect involves localhost. On production, set NUXT_PUBLIC_SITE_URL to your public https origin (e.g. DigitalOcean default ingress) and register https://ORIGIN/api/auth/gmail/callback in Google Cloud Console. Re-authorize after deploy.'
  }
  return 'invalid_grant: refresh token rejected — revoked token, wrong GMAIL_CLIENT_ID/SECRET vs the client that issued the token, or redirect URI not listed in Google Cloud Console. Align NUXT_PUBLIC_SITE_URL (or full GMAIL_REDIRECT_URI callback) with an authorized redirect URI, then Connect Gmail and update GMAIL_REFRESH_TOKEN on the server.'
}
