/**
 * @registry-id: inboxCollectionsInit
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Initialize inbox MongoDB collections and ensure indexes are created
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/models/InboxEmail.ts => InboxEmail model
 *   - app/models/EmailAttachment.ts => EmailAttachment model
 *   - app/models/ParsedData.ts => ParsedData model
 *   - app/models/ProcessingLog.ts => ProcessingLog model
 *   - app/lib/mongodb.ts => dbConnect for connection
 * 
 * @exports-to:
 *   ✓ app/api/inbox/sync/route.ts => Ensure collections ready before sync
 *   ✓ app/lib/services/inboxService.ts => Initialize on service startup
 */

import dbConnect from '@/lib/mongodb'
import InboxEmail from '@/models/InboxEmail'
import EmailAttachment from '@/models/EmailAttachment'
import ParsedData from '@/models/ParsedData'
import ProcessingLog from '@/models/ProcessingLog'

/**
 * Initialize inbox collections and create indexes
 * This ensures all indexes are created even if models haven't been used yet
 */
export async function initializeInboxCollections(): Promise<void> {
  try {
    // Connect to database
    await dbConnect()

    // Initialize models (this triggers index creation)
    // Mongoose will create indexes defined in schemas on first model use
    await Promise.all([
      InboxEmail.createIndexes(),
      EmailAttachment.createIndexes(),
      ParsedData.createIndexes(),
      ProcessingLog.createIndexes(),
    ])
  } catch (error) {
    throw new Error(
      `Failed to initialize inbox collections: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Ensure collections exist (lazy initialization)
 * Called automatically when models are first used
 */
export async function ensureInboxCollections(): Promise<void> {
  await dbConnect()
  // Models will auto-create collections on first document insert
  // Indexes are created via schema definitions
}
