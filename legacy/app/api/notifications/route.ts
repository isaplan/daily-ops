/**
 * @registry-id: notificationsAPI
 * @created: 2026-01-16T22:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Notifications API route - GET with pagination, PUT for read, DELETE
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/models/Notification.ts => Notification model
 *   - app/lib/types/errors.ts => Error handling utilities
 * 
 * @exports-to:
 *   ✓ app/lib/services/notificationService.ts => Notification service calls this endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Notification from '@/models/Notification'
import { getErrorMessage } from '@/lib/types/errors'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()

    const { searchParams } = new URL(request.url)
    const member_id = searchParams.get('member_id')
    const read = searchParams.get('read')
    const skip = parseInt(searchParams.get('skip') || '0', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const query: Record<string, unknown> = {}

    if (member_id) {
      query.member_id = member_id
    }

    if (read !== null && read !== undefined) {
      query.read = read === 'true'
    }

    const notifications = await Notification.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await Notification.countDocuments(query)

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        total,
        skip,
        limit,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect()

    const body = await request.json()
    const { notification_id, read } = body

    if (!notification_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'notification_id is required',
        },
        { status: 400 }
      )
    }

    const notification = await Notification.findByIdAndUpdate(
      notification_id,
      { read: read === true, read_at: read === true ? new Date() : undefined },
      { new: true }
    ).lean()

    if (!notification) {
      return NextResponse.json(
        {
          success: false,
          error: 'Notification not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: notification,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect()

    const { searchParams } = new URL(request.url)
    const notification_id = searchParams.get('id')

    if (!notification_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'notification_id is required',
        },
        { status: 400 }
      )
    }

    const result = await Notification.findByIdAndDelete(notification_id)

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Notification not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}
