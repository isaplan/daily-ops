/**
 * Gmail OAuth redirect — must match Google Cloud "Authorized redirect URIs" and the URI
 * used when `GMAIL_REFRESH_TOKEN` was issued (in-app flow: origin + `/api/auth/gmail/callback`).
 *
 * When `NUXT_PUBLIC_SITE_URL` / `GMAIL_REDIRECT_URI` are unset, pass the incoming `event` from
 * authorize/callback so the redirect uses the **actual** request host (e.g. DigitalOcean URL).
 *
 * @exports-to:
 * ✓ server/api/auth/gmail/authorize.get.ts
 * ✓ server/api/auth/gmail/callback.get.ts
 * ✓ server/services/gmailApiService.ts
 * ✓ server/services/gmailWatchService.ts
 */

import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'

const GMAIL_CALLBACK_PATH = '/api/auth/gmail/callback'

function originOnly(raw: string): string {
  return raw.replace(/\/$/, '')
}

function isOAuthPlaygroundRedirect(raw: string): boolean {
  return (
    raw === 'https://developers.google.com/oauthplayground' ||
    raw.includes('developers.google.com/oauthplayground')
  )
}

function originFromRequest(event: H3Event): string | null {
  try {
    const u = getRequestURL(event)
    return u?.origin ? originOnly(u.origin) : null
  } catch {
    return null
  }
}

/**
 * Callback URL from `NUXT_PUBLIC_SITE_URL`, else from the current request (prod without env),
 * else localhost.
 */
export function getGmailRedirectUri(event?: H3Event): string {
  const envOrigin = process.env.NUXT_PUBLIC_SITE_URL?.trim()
  if (envOrigin) {
    return `${originOnly(envOrigin)}${GMAIL_CALLBACK_PATH}`
  }
  if (event) {
    const fromReq = originFromRequest(event)
    if (fromReq) {
      return `${fromReq}${GMAIL_CALLBACK_PATH}`
    }
  }
  return `http://localhost:8080${GMAIL_CALLBACK_PATH}`
}

/**
 * Redirect URI passed to `google.auth.OAuth2` (authorize, callback, list, refresh).
 * - If `GMAIL_REDIRECT_URI` is set → full URL, origin-only + path, or Playground (legacy).
 * - Else → {@link getGmailRedirectUri} (`NUXT_PUBLIC_SITE_URL`, then request origin, then localhost).
 */
export function getGmailOAuthRedirectUri(event?: H3Event): string {
  const raw = process.env.GMAIL_REDIRECT_URI?.trim()
  if (!raw) {
    return getGmailRedirectUri(event)
  }
  const base = raw.split('?')[0] ?? raw
  if (isOAuthPlaygroundRedirect(base)) {
    return base
  }
  if (base.includes(GMAIL_CALLBACK_PATH)) {
    return base
  }
  return `${originOnly(base)}${GMAIL_CALLBACK_PATH}`
}
