/**
 * @registry-id: chatsMessageEditDeleteAPI
 * @created: 2026-01-20T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: API route for editing and deleting individual chat messages
 * @last-fix: [2026-01-20] Initial implementation - chat message edit/delete operations
 * 
 * @imports-from:
 *   - app/models/ChatMessage.ts => ChatMessage model
 *   - app/models/Note.ts => Note model for linked entity validation
 *   - app/models/Channel.ts => Channel model for linked entity validation
 *   - app/models/Todo.ts => Todo model for linked entity validation
 * 
 * @exports-to:
 *   ✓ app/lib/services/chatService.ts => Calls this API route
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import ChatMessage from '@/models/ChatMessage'
import Note from '@/models/Note'
import Channel from '@/models/Channel'
import Todo from '@/models/Todo'
import Event from '@/models/Event'
import Decision from '@/models/Decision'
import mongoose from 'mongoose'

function getModelByType(type: string) {
  switch (type) {
    case 'note':
      return Note
    case 'channel':
      return Channel
    case 'todo':
      return Todo
    case 'event':
      return Event
    case 'decision':
      return Decision
    default:
      return null
  }
}

function extractPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function extractMentionIds(html: string): string[] {
  const mentionRegex = /data-type="mention"\s+data-id="([^"]+)"/g
  const ids: string[] = []
  let match
  while ((match = mentionRegex.exec(html)) !== null) {
    ids.push(match[1])
  }
  return ids
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    await dbConnect()
    const { messageId } = await params
    const body = await request.json()
    const { editorHtml, plainText, mentionedMembers, linkedEntities } = body

    const chatMessage = await ChatMessage.findById(messageId)
    if (!chatMessage) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    if (chatMessage.is_deleted) {
      return NextResponse.json(
        { success: false, error: 'Cannot edit deleted message' },
        { status: 400 }
      )
    }

    // Update fields if provided
    if (editorHtml !== undefined) {
      chatMessage.editor_html = editorHtml.trim()
      chatMessage.plain_text = plainText || extractPlainText(editorHtml)
    }

    if (mentionedMembers !== undefined) {
      chatMessage.mentioned_members = mentionedMembers.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      )
    } else if (editorHtml) {
      // Extract mentions from HTML if not provided
      chatMessage.mentioned_members = extractMentionIds(editorHtml).map(
        (id: string) => new mongoose.Types.ObjectId(id)
      )
    }

    if (linkedEntities !== undefined) {
      // Validate and normalize linked entities
      const normalizedLinkedEntities = []
      if (Array.isArray(linkedEntities)) {
        for (const link of linkedEntities) {
          if (link.type && link.entityId) {
            const Model = getModelByType(link.type)
            if (Model) {
              try {
                const entity = await Model.findById(link.entityId).lean()
                if (entity) {
                  normalizedLinkedEntities.push({
                    type: link.type,
                    id: new mongoose.Types.ObjectId(link.entityId),
                  })
                }
              } catch (err) {
                console.warn(`Failed to validate linked entity ${link.type}:${link.entityId}:`, err)
              }
            }
          }
        }
      }
      chatMessage.linked_entities = normalizedLinkedEntities
    }

    chatMessage.edited_at = new Date()
    await chatMessage.save()

    await chatMessage.populate('author_id', 'name email')

    return NextResponse.json({
      success: true,
      data: {
        _id: chatMessage._id.toString(),
        channel_id: chatMessage.channel_id.toString(),
        author_id:
          chatMessage.author_id && typeof chatMessage.author_id === 'object'
            ? {
                _id: chatMessage.author_id._id.toString(),
                name: chatMessage.author_id.name,
                email: chatMessage.author_id.email,
              }
            : chatMessage.author_id?.toString(),
        editor_html: chatMessage.editor_html,
        plain_text: chatMessage.plain_text,
        mentioned_members: chatMessage.mentioned_members.map((id: any) => id.toString()),
        linked_entities: (chatMessage.linked_entities || []).map((link) => ({
          type: link.type,
          id: link.id.toString(),
        })),
        attachments: chatMessage.attachments || [],
        timestamp: chatMessage.timestamp.toISOString(),
        edited_at: chatMessage.edited_at?.toISOString(),
        is_deleted: chatMessage.is_deleted,
      },
    })
  } catch (error) {
    console.error('Error updating chat message:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update message'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    await dbConnect()
    const { messageId } = await params

    const chatMessage = await ChatMessage.findById(messageId)
    if (!chatMessage) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    chatMessage.is_deleted = true
    await chatMessage.save()

    return NextResponse.json({
      success: true,
      data: {},
    })
  } catch (error) {
    console.error('Error deleting chat message:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete message'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
