/**
 * @registry-id: messagesSendAPI
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-18T12:50:00.000Z
 * @description: API route for sending messages with BlockNote editor content
 * @last-fix: [2026-01-18] Auto-gets first active member if userId not provided - removed userId requirement
 * 
 * @imports-from:
 *   - app/models/Message.ts => Message model
 *   - app/lib/types/editor.types.ts => EditorContent, EditorAttachment types
 * 
 * @exports-to:
 *   ✓ app/lib/services/messageService.ts => Calls this API route
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Message from '@/models/Message'
import Member from '@/models/Member'
import type { EditorContent, EditorAttachment } from '@/lib/types/editor.types'

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    const { channelId, content, editorContent, mentions, attachments, userId } = body

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

    // Handle HTML editor content (from TipTap) or BlockNote content
    let editorContentData: EditorContent | string | undefined = undefined
    
    // If editorContent is a string (HTML from TipTap), use it directly
    // Otherwise, treat it as BlockNote format
    if (editorContent) {
      if (typeof editorContent === 'string') {
        // It's HTML from TipTap - store as string (even if it doesn't start with <)
        const trimmed = editorContent.trim()
        if (trimmed.length > 0) {
          editorContentData = trimmed
        }
      } else if (Array.isArray(editorContent)) {
        // It's BlockNote format
        editorContentData = editorContent as EditorContent
      }
    }
    
    // Extract text from content for display
    let messageText = content || ''
    if (!messageText && editorContentData) {
      if (typeof editorContentData === 'string') {
        // HTML content - extract text
        const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null
        if (tempDiv) {
          tempDiv.innerHTML = editorContentData
          messageText = tempDiv.textContent || tempDiv.innerText || ''
        } else {
          // Server-side fallback - basic HTML tag removal
          messageText = editorContentData.replace(/<[^>]*>/g, '').trim()
        }
      } else if (Array.isArray(editorContentData)) {
        // BlockNote format
        messageText = editorContentData
          .map((block: any) => {
            if (block.content && Array.isArray(block.content)) {
              return block.content
                .map((c: any) => (typeof c === 'string' ? c : c.text || ''))
                .join('')
            }
            return ''
          })
          .filter(Boolean)
          .join('\n')
      }
    }

    // Validate that we have some content
    if (!messageText.trim() && !editorContentData) {
      return NextResponse.json(
        { success: false, error: 'Message content cannot be empty' },
        { status: 400 }
      )
    }

    const attachmentsData = (attachments || []) as EditorAttachment[]

    const message = new Message({
      channel_id: channelId,
      member_id: memberId,
      text: messageText,
      editor_content: editorContentData, // Store HTML string or BlockNote format
      mentioned_members: mentions?.map((m: { id: string }) => m.id) || [],
      attachments: attachmentsData.map((att) => ({
        id: att.id,
        url: att.url,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        uploadedAt: new Date(att.uploadedAt),
        uploadedBy: memberId,
      })),
      timestamp: new Date(),
    })

    await message.save()

    return NextResponse.json({
      success: true,
      data: {
        message: {
          _id: message._id.toString(),
          channel_id: message.channel_id.toString(),
          content: messageText,
          editor_content: editorContentData, // Return the stored HTML/BlockNote content
          author_id: memberId,
          timestamp: message.timestamp.toISOString(),
          attachments: message.attachments,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
