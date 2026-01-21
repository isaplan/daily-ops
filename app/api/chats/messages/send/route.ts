/**
 * @registry-id: chatsMessagesSendAPI
 * @created: 2026-01-20T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: API route for sending chat messages with TipTap HTML content, mentions, attachments, and linked entities
 * @last-fix: [2026-01-20] Initial implementation - chat-specific message sending with ChatMessage model
 * 
 * @imports-from:
 *   - app/models/ChatMessage.ts => ChatMessage model
 *   - app/models/Member.ts => Member model for author resolution
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
import Member from '@/models/Member'
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
  // Server-side HTML tag removal
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function extractMentionIds(html: string): string[] {
  // Extract mention IDs from TipTap HTML: <span data-type="mention" data-id="...">
  const mentionRegex = /data-type="mention"\s+data-id="([^"]+)"/g
  const ids: string[] = []
  let match
  while ((match = mentionRegex.exec(html)) !== null) {
    ids.push(match[1])
  }
  return ids
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    const {
      channelId,
      editorHtml,
      plainText,
      mentionedMembers,
      linkedEntities,
      attachments,
      userId,
    } = body

    // Auto-get first active member if no userId provided
    let memberId = userId
    if (!memberId) {
      const firstMember = await Member.findOne({ is_active: true }).lean()
      if (!firstMember) {
        return NextResponse.json(
          { success: false, error: 'No active members found' },
          { status: 400 }
        )
      }
      memberId = firstMember._id.toString()
    }

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: channelId' },
        { status: 400 }
      )
    }

    if (!editorHtml || typeof editorHtml !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: editorHtml' },
        { status: 400 }
      )
    }

    // Extract plain text if not provided
    const extractedPlainText = plainText || extractPlainText(editorHtml)
    if (!extractedPlainText.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message content cannot be empty' },
        { status: 400 }
      )
    }

    // Extract mentions from HTML if not provided
    const extractedMentions = mentionedMembers || extractMentionIds(editorHtml)

    // Validate and normalize linked entities
    const normalizedLinkedEntities = []
    if (linkedEntities && Array.isArray(linkedEntities)) {
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

    // Normalize attachments
    const normalizedAttachments = (attachments || []).map((att: any) => ({
      id: att.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: att.url,
      type: att.type || (att.mimeType?.startsWith('image/') ? 'image' : att.mimeType?.startsWith('video/') ? 'video' : 'file'),
      mime_type: att.mimeType || att.mime_type || 'application/octet-stream',
      size: att.size || 0,
      upload_timestamp: new Date(att.uploadTimestamp || att.upload_timestamp || Date.now()),
      uploaded_by: new mongoose.Types.ObjectId(memberId),
      filename: att.filename,
    }))

    const chatMessage = new ChatMessage({
      channel_id: new mongoose.Types.ObjectId(channelId),
      author_id: new mongoose.Types.ObjectId(memberId),
      editor_html: editorHtml.trim(),
      plain_text: extractedPlainText,
      mentioned_members: extractedMentions.map((id: string) => new mongoose.Types.ObjectId(id)),
      linked_entities: normalizedLinkedEntities,
      attachments: normalizedAttachments,
      timestamp: new Date(),
      is_deleted: false,
    })

    await chatMessage.save()

    // Populate author for response
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
        linked_entities: normalizedLinkedEntities.map((link) => ({
          type: link.type,
          id: link.id.toString(),
        })),
        attachments: normalizedAttachments,
        timestamp: chatMessage.timestamp.toISOString(),
        is_deleted: chatMessage.is_deleted,
      },
    })
  } catch (error) {
    console.error('Error sending chat message:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
