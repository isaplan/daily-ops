/**
 * @registry-id: chatsMessagesAPI
 * @created: 2026-01-16T15:55:00.000Z
 * @last-modified: 2026-01-18T00:00:00.000Z
 * @description: API route for fetching messages in a channel with pagination
 * @last-fix: [2026-01-18] Added editor_content and attachments to response
 * 
 * @imports-from:
 *   - app/models/Message.ts => Message model
 * 
 * @exports-to:
 *   ✓ app/lib/services/messageService.ts => Calls this API route
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Message from '@/models/Message'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    await dbConnect()
    const { channelId } = await params
    const { searchParams } = new URL(request.url)
    const skip = parseInt(searchParams.get('skip') || '0', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const messages = await Message.find({ channel_id: channelId, is_deleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ timestamp: -1 })
      .populate('member_id', 'name email')
      .lean()

    const total = await Message.countDocuments({ channel_id: channelId, is_deleted: false })

    const formattedMessages = messages.map((msg) => {
      const editorContent = msg.editor_content 
        ? (typeof msg.editor_content === 'string' 
            ? msg.editor_content  // Return HTML string as-is
            : Array.isArray(msg.editor_content) 
              ? JSON.stringify(msg.editor_content)  // BlockNote format as JSON string
              : msg.editor_content ? String(msg.editor_content) : undefined)
        : undefined
      
      return {
        _id: msg._id.toString(),
        channel_id: msg.channel_id.toString(),
        content: msg.text,
        editor_content: editorContent,
        attachments: msg.attachments || undefined,
        author_id: msg.member_id
          ? typeof msg.member_id === 'object'
            ? {
                _id: msg.member_id._id.toString(),
                name: msg.member_id.name,
                email: msg.member_id.email,
              }
            : msg.member_id.toString()
          : undefined,
        timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
        mentioned_members: msg.mentioned_members?.map((id: any) => id.toString()) || undefined,
        mentions: msg.linked_note || msg.linked_todo
          ? [
              ...(msg.linked_note ? [{ type: 'note' as const, id: msg.linked_note.toString() }] : []),
              ...(msg.linked_todo ? [{ type: 'todo' as const, id: msg.linked_todo.toString() }] : []),
            ]
          : undefined,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        messages: formattedMessages,
        total,
        skip,
        limit,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
