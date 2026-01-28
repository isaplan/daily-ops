/**
 * @registry-id: inboxDetailAPI
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox detail API - get single email with attachments and parsed data
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/models/InboxEmail.ts => InboxEmail model
 *   - app/models/EmailAttachment.ts => EmailAttachment model
 *   - app/models/ParsedData.ts => ParsedData model
 *   - app/lib/mongodb/inbox-collections.ts => Collection initialization
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/[emailId]/page.tsx => Shows email detail
 */

import { NextRequest, NextResponse } from 'next/server'
import { ensureInboxCollections } from '@/lib/mongodb/inbox-collections'
import InboxEmail from '@/models/InboxEmail'
import EmailAttachment from '@/models/EmailAttachment'
import ParsedData from '@/models/ParsedData'
import dbConnect from '@/lib/mongodb'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    await ensureInboxCollections()

    const { id } = await params

    // Get email
    const email = await InboxEmail.findById(id).lean()

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 }
      )
    }

    // Get attachments
    const attachments = await EmailAttachment.find({ emailId: id }).lean()

    // Get parsed data for each attachment
    const parsedDataMap = new Map()
    const parsedDataIds = attachments
      .map((att) => att.parsedDataRef)
      .filter((id) => id !== null && id !== undefined)

    if (parsedDataIds.length > 0) {
      const parsedData = await ParsedData.find({ _id: { $in: parsedDataIds } }).lean()
      parsedData.forEach((pd) => {
        parsedDataMap.set(pd._id.toString(), pd)
      })
    }

    // Combine attachments with parsed data
    const attachmentsWithData = attachments.map((att) => ({
      ...att,
      _id: att._id.toString(),
      emailId: att.emailId.toString(),
      parsedData: att.parsedDataRef
        ? parsedDataMap.get(att.parsedDataRef.toString())
        : undefined,
    }))

    return NextResponse.json({
      success: true,
      data: {
        ...email,
        _id: email._id.toString(),
        attachments: attachmentsWithData,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get email',
      },
      { status: 500 }
    )
  }
}
