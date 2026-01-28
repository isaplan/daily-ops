/**
 * @registry-id: inboxListAPI
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox list API - list emails with pagination and filters
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/models/InboxEmail.ts => InboxEmail model
 *   - app/models/EmailAttachment.ts => EmailAttachment model
 *   - app/lib/mongodb/inbox-collections.ts => Collection initialization
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/emails/page.tsx => Lists emails
 */

import { NextRequest, NextResponse } from 'next/server'
import { ensureInboxCollections } from '@/lib/mongodb/inbox-collections'
import InboxEmail from '@/models/InboxEmail'
import EmailAttachment from '@/models/EmailAttachment'
import dbConnect from '@/lib/mongodb'
import type { InboxEmailFilters } from '@/lib/types/inbox.types'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    await ensureInboxCollections()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    // Build filters
    const filters: Record<string, unknown> = {}

    const status = searchParams.get('status')
    if (status) filters.status = status

    const from = searchParams.get('from')
    if (from) filters.from = from

    const archived = searchParams.get('archived')
    if (archived !== null) {
      filters.archived = archived === 'true'
    } else {
      filters.archived = false // Default: show non-archived
    }

    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    if (dateFrom || dateTo) {
      filters.receivedAt = {}
      if (dateFrom) {
        filters.receivedAt = { ...filters.receivedAt, $gte: new Date(dateFrom) }
      }
      if (dateTo) {
        filters.receivedAt = { ...filters.receivedAt, $lte: new Date(dateTo) }
      }
    }

    // Query emails
    const [emails, total] = await Promise.all([
      InboxEmail.find(filters)
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InboxEmail.countDocuments(filters),
    ])

    // Get attachment counts for each email
    const emailIds = emails.map((e) => e._id)
    const attachmentCounts = await EmailAttachment.aggregate([
      { $match: { emailId: { $in: emailIds } } },
      {
        $group: {
          _id: '$emailId',
          count: { $sum: 1 },
          parsedCount: {
            $sum: { $cond: [{ $eq: ['$parseStatus', 'success'] }, 1, 0] },
          },
        },
      },
    ])

    const countMap = new Map(
      attachmentCounts.map((ac) => [ac._id.toString(), { total: ac.count, parsed: ac.parsedCount }])
    )

    const emailsWithCounts = emails.map((email) => ({
      ...email,
      _id: email._id.toString(),
      attachmentStats: countMap.get(email._id.toString()) || { total: 0, parsed: 0 },
    }))

    return NextResponse.json({
      success: true,
      data: {
        emails: emailsWithCounts,
        total,
        hasMore: skip + limit < total,
        page,
        limit,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list emails',
      },
      { status: 500 }
    )
  }
}
