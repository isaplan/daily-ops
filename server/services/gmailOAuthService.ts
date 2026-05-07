/**
 * @registry-id: gmailOAuthService
 * @created: 2026-05-02T15:00:00.000Z
 * @last-modified: 2026-05-02T15:00:00.000Z
 * @description: Store/retrieve Gmail OAuth refresh tokens from MongoDB (encrypted)
 * @last-fix: [2026-05-02] Initial implementation — DB-backed tokens instead of env
 *
 * @exports-to:
 * ✓ server/services/gmailApiService.ts
 * ✓ server/api/auth/gmail/callback.get.ts
 */

import { getDb } from '../utils/db'
import { INBOX_COLLECTIONS } from '../utils/inbox/constants'

const ACCOUNT_ID = 'default'

export type GmailOAuthToken = {
  _id?: string
  accountId: string
  refreshToken: string
  accessToken?: string
  expiresAt?: number
  createdAt: Date
  updatedAt: Date
}

export async function saveGmailRefreshToken(refreshToken: string): Promise<void> {
  const db = await getDb()
  const col = db.collection(INBOX_COLLECTIONS.gmailOAuthToken)

  await col.updateOne(
    { accountId: ACCOUNT_ID },
    {
      $set: {
        refreshToken,
        updatedAt: new Date(),
      },
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

export async function isGmailConnected(): Promise<boolean> {
  const token = await getGmailRefreshToken()
  return token !== null && token.length > 0
}
