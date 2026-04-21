/**
 * Single source of truth for Gmail OAuth2 redirect_uri (must match minting of GMAIL_REFRESH_TOKEN).
 *
 * @last-modified: 2026-04-21T22:30:00.000Z
 * @last-fix: [2026-04-21] Production requires explicit GMAIL_REDIRECT_URI — no silent localhost fallback
 *
 * @exports-to:
 * ✓ server/services/gmailApiService.ts
 * ✓ server/services/gmailWatchService.ts
 */

/** Redirect URI sent to Google on token refresh (must match authorized URI + refresh token issuance). */
export function getGmailOAuthRedirectUri(): string {
  const raw = process.env.GMAIL_REDIRECT_URI
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (trimmed) return trimmed

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'GMAIL_REDIRECT_URI is missing or empty in production. Set it on the Web component to the same value used when minting GMAIL_REFRESH_TOKEN (e.g. https://developers.google.com/oauthplayground).',
    )
  }

  return 'http://localhost:8080'
}
