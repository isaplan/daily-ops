/**
 * @registry-id: inboxWatchAPI
 * @created: 2026-01-27T12:00:00.000Z
 * @last-modified: 2026-01-27T12:00:00.000Z
 * @description: Inbox watch API - manage Gmail push notification subscriptions
 * @last-fix: [2026-01-27] Initial implementation - Start/stop Gmail watch subscriptions
 * 
 * @imports-from:
 *   - app/lib/services/gmailWatchService.ts => Gmail watch service
 *   - app/lib/mongodb/inbox-collections.ts => Collection initialization
 * 
 * @exports-to:
 *   ✓ app/lib/services/inboxService.ts => Uses this endpoint for watch management
 */

import { NextRequest, NextResponse } from 'next/server'
import { gmailWatchService } from '@/lib/services/gmailWatchService'
import { ensureInboxCollections } from '@/lib/mongodb/inbox-collections'
import dbConnect from '@/lib/mongodb'

/**
 * POST /api/inbox/watch
 * Start watching for Gmail inbox changes
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    await ensureInboxCollections()

    const body = await request.json().catch(() => ({}))
    const topicName = body.topicName || process.env.GMAIL_PUBSUB_TOPIC

    if (!topicName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pub/Sub topic name is required. Set GMAIL_PUBSUB_TOPIC or provide topicName in request body.',
        },
        { status: 400 }
      )
    }

    // Start watching
    const result = await gmailWatchService.watch({
      topicName,
      labelIds: body.labelIds || ['INBOX'],
    })

    return NextResponse.json({
      success: true,
      data: {
        historyId: result.historyId,
        expiration: result.expiration,
        topicName,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start Gmail watch',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inbox/watch
 * Stop watching for Gmail inbox changes
 */
export async function DELETE() {
  try {
    await dbConnect()
    await ensureInboxCollections()

    await gmailWatchService.stop()

    return NextResponse.json({
      success: true,
      data: { message: 'Gmail watch stopped successfully' },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop Gmail watch',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/inbox/watch
 * Get current watch status (if stored in database)
 */
export async function GET() {
  try {
    await dbConnect()
    await ensureInboxCollections()

    // Note: Gmail API doesn't provide a way to check watch status
    // You would need to store this in your database
    // For now, we'll return a simple response

    return NextResponse.json({
      success: true,
      data: {
        message: 'Watch status check not implemented. Use POST to start, DELETE to stop.',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get watch status',
      },
      { status: 500 }
    )
  }
}
