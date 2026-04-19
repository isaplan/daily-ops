/**
 * @registry-id: inboxWebhookAPI
 * @created: 2026-01-27T12:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: POST /api/inbox/webhook — Google Pub/Sub push (Gmail watch)
 * @last-fix: [2026-04-18] Delegates to inboxWebhookService; 400 on bad body; 200 on processing errors (Pub/Sub ack)
 *
 * @imports-from:
 *   - server/services/inboxWebhookService.ts => handleInboxPubSubPush
 *   - server/utils/inbox/collections.ts => ensureInboxCollections, ensureInboxIndexes
 *
 * @exports-to:
 *   ✓ Google Cloud Pub/Sub push subscription endpoint
 */

import { ensureInboxCollections, ensureInboxIndexes } from '../../utils/inbox/collections'
import { handleInboxPubSubPush } from '../../services/inboxWebhookService'

export default defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections()
    await ensureInboxIndexes()

    const body = await readBody(event).catch(() => null)

    const result = await handleInboxPubSubPush(body)

    if (!result.success) {
      throw createError({
        statusCode: result.statusCode,
        statusMessage: result.error,
      })
    }

    return {
      success: true,
      data: result.data,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const sc = (error as { statusCode?: number }).statusCode
      if (sc === 400) throw error
    }

    setResponseStatus(event, 200)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process webhook',
    }
  }
})
