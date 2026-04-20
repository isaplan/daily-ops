/**
 * @registry-id: inboxSyncPostAPI
 * @created: 2026-04-18T00:00:00.000Z
 * @last-modified: 2026-04-20T00:00:00.000Z
 * @description: POST /api/inbox/sync — manual Gmail fetch (same pipeline as sync-scheduled)
 * @last-fix: [2026-04-20] Delegates to inboxSyncService.runInboxGmailSync
 *
 * @exports-to:
 * ✓ composables/useInboxApi.ts
 */

import { runInboxGmailSync } from '../../services/inboxSyncService'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({})) as { maxResults?: number; query?: string }
    return await runInboxGmailSync({
      maxResults: body.maxResults,
      query: body.query,
    })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to sync emails',
    })
  }
})
