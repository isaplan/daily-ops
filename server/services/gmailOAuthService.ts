/**
 * @registry-id: gmailOAuthService
 * @created: 2026-05-02T15:00:00.000Z
 * @last-modified: 2026-05-14T14:00:00.000Z
 * @description: Store/retrieve Gmail OAuth refresh tokens from MongoDB (encrypted)
 * @last-fix: [2026-05-14] Persist oauthRedirectUri on connect; resolveGmailOAuthRedirectUriForServer for Nitro/cron without request
 *
 * @exports-to:
 * ✓ server/services/gmailApiService.ts
 * ✓ server/api/auth/gmail/callback.get.ts
 * ✓ server/services/gmailWatchService.ts
 */

import { getGmailOAuthRedirectUri } from '../utils/gmailRedirectUri'
import { getDb } from '../utils/db'
import { INBOX_COLLECTIONS } from '../utils/inbox/constants'

const ACCOUNT_ID = 'default'

export type GmailOAuthToken = {
  _id?: string
  accountId: string
  refreshToken: string
  /** Redirect URI used when this refresh token was issued (for server-side refresh when env has no public URL). */
  oauthRedirectUri?: string
  accessToken?: string
  expiresAt?: number
  createdAt: Date
  updatedAt: Date
}

export async function saveGmailRefreshToken(
  refreshToken: string,
  opts?: { oauthRedirectUri?: string },
): Promise<void> {
  const db = await getDb()
  const col = db.collection(INBOX_COLLECTIONS.gmailOAuthToken)

  const $set: Record<string, unknown> = {
    refreshToken,
    updatedAt: new Date(),
  }
  const trimmedRedirect = opts?.oauthRedirectUri?.trim()
  if (trimmedRedirect) {
    $set.oauthRedirectUri = trimmedRedirect
  }

  await col.updateOne(
    { accountId: ACCOUNT_ID },
    {
      $set,
      $setOnInsert: {
        accountId: ACCOUNT_ID,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  )
}

export async function getGmailRefreshToken(): Promise<string | null> {
  const db = await getDb()
  const col = db.collection(INBOX_COLLECTIONS.gmailOAuthToken)
  const doc = await col.findOne({ accountId: ACCOUNT_ID })
  const token = doc?.refreshToken ?? null
  console.log('[gmailOAuthService] getGmailRefreshToken found:', !!token, token ? `${token.substring(0, 20)}...` : 'null')
  return token
}

/** Redirect URI saved at last in-app OAuth callback (used when env has no public site URL). */
export async function getGmailStoredOAuthRedirectUri(): Promise<string | null> {
  const db = await getDb()
  const col = db.collection(INBOX_COLLECTIONS.gmailOAuthToken)
  const doc = await col.findOne({ accountId: ACCOUNT_ID })
  const raw = doc && typeof (doc as { oauthRedirectUri?: unknown }).oauthRedirectUri === 'string'
    ? String((doc as { oauthRedirectUri: string }).oauthRedirectUri).trim()
    : ''
  return raw.length > 0 ? raw : null
}

/**
 * OAuth2 `redirect_uri` for background Gmail calls (no HTTP `event`).
 * Uses env when set; otherwise last stored callback URL from Connect Gmail.
 */
export async function resolveGmailOAuthRedirectUriForServer(): Promise<string> {
  const hasExplicitSite =
    Boolean(process.env.GMAIL_REDIRECT_URI?.trim()) ||
    Boolean(process.env.NUXT_PUBLIC_SITE_URL?.trim())
  const canonical = getGmailOAuthRedirectUri()
  if (hasExplicitSite) {
    return canonical
  }
  const stored = await getGmailStoredOAuthRedirectUri()
  if (stored) {
    return stored
  }
  return canonical
}

export async function isGmailConnected(): Promise<boolean> {
  const token = await getGmailRefreshToken()
  return token !== null && token.length > 0
}
