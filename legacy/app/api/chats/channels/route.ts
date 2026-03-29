/**
 * @registry-id: chatsChannelsAPI
 * @created: 2026-01-16T15:55:00.000Z
 * @last-modified: 2026-01-16T21:00:00.000Z
 * @description: API route for listing channels with linked entity counts and message counts
 * @last-fix: [2026-01-16] Added message counts for popularity sorting
 * 
 * @imports-from:
 *   - app/models/Channel.ts => Channel model
 *   - app/models/Note.ts => Note model
 *   - app/models/Todo.ts => Todo model
 *   - app/models/Message.ts => Message model for message counts
 * 
 * @exports-to:
 *   ✓ app/lib/services/channelService.ts => Calls this API route
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Channel from '@/models/Channel'
import Note from '@/models/Note'
import Todo from '@/models/Todo'
import Message from '@/models/Message'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const { searchParams } = new URL(request.url)
    const skip = parseInt(searchParams.get('skip') || '0', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const channels = await Channel.find({ is_archived: false })
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 })
      .lean()

    const channelsWithLinks = await Promise.all(
      channels.map(async (channel) => {
        const notesCount = await Note.countDocuments({
          'linked_entities': {
            $elemMatch: { type: 'channel', id: channel._id },
          },
        })
        const todosCount = await Todo.countDocuments({
          'linked_entities': {
            $elemMatch: { type: 'channel', id: channel._id },
          },
        })
        const messagesCount = await Message.countDocuments({
          channel_id: channel._id,
          is_deleted: false,
        })

        return {
          _id: channel._id.toString(),
          name: channel.name,
          description: channel.description,
          type: channel.type,
          members: channel.members?.map((m: { toString: () => string }) => m.toString()),
          created_by: channel.created_by?.toString(),
          connected_to: channel.connected_to,
          is_archived: channel.is_archived,
          created_at: channel.created_at?.toISOString() || new Date().toISOString(),
          updated_at: channel.updated_at?.toISOString() || new Date().toISOString(),
          linked_entities_count: {
            notes: notesCount,
            todos: todosCount,
          },
          messages_count: messagesCount,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        channels: channelsWithLinks,
        total: channels.length,
        skip,
        limit,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
}
