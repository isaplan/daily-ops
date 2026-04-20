/**
 * Normalize googleapis / Gaxios OAuth errors for inbox routes.
 *
 * @exports-to:
 * ✓ server/api/inbox/watch.post.ts
 * ✓ server/api/inbox/watch/renew.get.ts
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
