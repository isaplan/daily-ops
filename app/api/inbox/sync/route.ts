/**
 * @registry-id: inboxSyncAPI
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox sync API - fetch emails from Gmail and store in database
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/gmailApiService.ts => Gmail API client
 *   - app/lib/services/emailProcessorService.ts => Email processing
 *   - app/lib/services/inboxService.ts => Inbox CRUD operations
 *   - app/lib/mongodb/inbox-collections.ts => Collection initialization
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/page.tsx => Triggers email sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { emailProcessorService } from '@/lib/services/emailProcessorService'
import { inboxService } from '@/lib/services/inboxService'
import { ensureInboxCollections } from '@/lib/mongodb/inbox-collections'
import InboxEmail from '@/models/InboxEmail'
import EmailAttachment from '@/models/EmailAttachment'
import ProcessingLog from '@/models/ProcessingLog'
import dbConnect from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    await ensureInboxCollections()

    const body = await request.json().catch(() => ({}))
    const maxResults = body.maxResults || 50
    const query = body.query

    // Process emails from Gmail
    const processedEmails = await emailProcessorService.processEmails({
      maxResults,
      query,
    })

    let emailsCreated = 0
    let emailsFailed = 0

    for (const processed of processedEmails) {
      try {
        // Check if email already exists
        const existing = await InboxEmail.findOne({ messageId: processed.email.messageId })

        if (existing) {
          continue // Skip duplicates
        }

        // Create email record
        const email = await InboxEmail.create(processed.email)

        // Create attachments
        for (const attachmentDto of processed.attachments) {
          await EmailAttachment.create({
            ...attachmentDto,
            emailId: email._id,
          })
        }

        // Log success
        await ProcessingLog.create({
          emailId: email._id,
          eventType: 'fetch',
          status: 'success',
          message: `Email fetched and stored: ${processed.email.subject}`,
        })

        emailsCreated++
      } catch (error) {
        emailsFailed++

        // Log error
        await ProcessingLog.create({
          eventType: 'fetch',
          status: 'error',
          message: `Failed to store email: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { email: processed.email },
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        emailsCreated,
        emailsFailed,
        total: processedEmails.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync emails',
      },
      { status: 500 }
    )
  }
}
