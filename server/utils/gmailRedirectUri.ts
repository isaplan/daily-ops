/**
 * Get the base URL for redirect_uri — must match authorize, callback, and gmailApiService
 * @exports-to:
 * ✓ server/api/auth/gmail/authorize.get.ts
 * ✓ server/api/auth/gmail/callback.get.ts
 * ✓ server/services/gmailApiService.ts
 */

export function getGmailRedirectUri(): string {
  const baseUrl = process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:8080'
  return `${baseUrl}/api/auth/gmail/callback`
}
