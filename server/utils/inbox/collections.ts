/**
 * @registry-id: inboxCollectionsInit
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: Ensure inbox MongoDB collections and indexes (native driver, compatible with legacy Mongoose data)
 * @last-fix: [2026-04-18] Nuxt port from next-js-old inbox-collections
 *
 * @exports-to:
 * ✓ server/api/inbox (all routes)
 * ✓ server/services/inboxRepository.ts
 */

import { getDb } from '../db'
import { INBOX_COLLECTIONS, INBOX_TARGET_COLLECTIONS } from './constants'

export async function ensureInboxCollections(): Promise<void> {
  const db = await getDb()
  await Promise.all(
    INBOX_TARGET_COLLECTIONS.map((name) =>
      db.createCollection(name).catch(() => {
        /* exists */
      }),
    ),
  )
}

export async function ensureInboxIndexes(): Promise<void> {
  const db = await getDb()
  const emails = db.collection(INBOX_COLLECTIONS.inboxEmail)
  const attachments = db.collection(INBOX_COLLECTIONS.emailAttachment)
  const parsed = db.collection(INBOX_COLLECTIONS.parsedData)
  const logs = db.collection(INBOX_COLLECTIONS.processingLog)
  const oauthTokens = db.collection(INBOX_COLLECTIONS.gmailOAuthToken)

  await Promise.all([
    emails.createIndex({ messageId: 1 }, { unique: true }),
    emails.createIndex({ from: 1 }),
    emails.createIndex({ receivedAt: -1 }),
    emails.createIndex({ archived: 1, status: 1 }),
    emails.createIndex({ archived: 1, receivedAt: -1 }),
    attachments.createIndex({ emailId: 1 }),
    attachments.createIndex({ emailId: 1, parseStatus: 1 }),
    attachments.createIndex({ documentType: 1, parseStatus: 1 }),
    parsed.createIndex({ attachmentId: 1, documentType: 1 }),
    parsed.createIndex({ emailId: 1, documentType: 1 }),
    logs.createIndex({ emailId: 1, timestamp: -1 }),
    logs.createIndex({ attachmentId: 1, timestamp: -1 }),
    oauthTokens.createIndex({ accountId: 1 }, { unique: true }),
    oauthTokens.createIndex({ createdAt: -1 }),
  ]).catch(() => {
    /* index may already exist with different options */
  })
}
