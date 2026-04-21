/**
 * Normalize googleapis / Gaxios OAuth errors for inbox routes.
 *
 * @last-modified: 2026-04-22T00:30:00.000Z
 * @last-fix: [2026-04-22] getGmailInvalidGrantHint for Playground-aligned env (token mismatch vs localhost)
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

/** Actionable hint when refresh fails — different copy if redirect still looks like localhost. */
export function getGmailInvalidGrantHint(redirectUriEnv: string, redirectUriUsed: string): string {
  const a = (redirectUriEnv + redirectUriUsed).toLowerCase()
  const looksLocal =
    a.includes('localhost') || a.includes('127.0.0.1') || a.includes('0.0.0.0')
  if (looksLocal) {
    return 'Redirect URI is still localhost somewhere. On App Platform, the Web component env can override app-level GMAIL_REDIRECT_URI — remove the duplicate or set https://developers.google.com/oauthplayground on the daily-ops component, redeploy, then ensure GMAIL_REFRESH_TOKEN was issued for that same redirect + client.'
  }
  return 'Redirect URI matches Playground. invalid_grant here almost always means GMAIL_REFRESH_TOKEN is revoked or was issued for different GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET than on the server. In OAuth Playground use the exact same OAuth client as DigitalOcean, authorize Gmail API scopes, copy the new refresh token into GMAIL_REFRESH_TOKEN (DO secrets), save, redeploy.'
}
