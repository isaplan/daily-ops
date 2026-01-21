/**
 * @registry-id: messageEditDeleteAPI
 * @created: 2026-01-21T00:00:00.000Z
 * @last-modified: 2026-01-21T00:00:00.000Z
 * @description: API route for editing and deleting messages
 * @last-fix: [2026-01-21] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Message from '@/models/Message'
import { getErrorMessage } from '@/lib/types/errors'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect()
    const messageId = params.id
    const body = await request.json()
    const { text, editor_content, plainText } = body

    // Find the message
    const message = await Message.findById(messageId)
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    // Update message
    const updateData: any = {
      text: text || plainText || message.text,
      edited_at: new Date(),
      updated_at: new Date(),
    }

    if (editor_content !== undefined) {
      updateData.editor_content = editor_content
    }

    Object.assign(message, updateData)
    await message.save()

    await message.populate('member_id', 'name email')
    await message.populate('channel_id', 'name')

    return NextResponse.json({
      success: true,
      data: message,
    })
  } catch (error) {
    console.error('Error updating message:', error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect()
    const messageId = params.id

    // Find the message
    const message = await Message.findById(messageId)
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    // Soft delete - set is_deleted flag
    message.is_deleted = true
    message.updated_at = new Date()
    await message.save()

    return NextResponse.json({
      success: true,
      data: { _id: messageId },
    })
  } catch (error) {
    console.error('Error deleting message:', error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
