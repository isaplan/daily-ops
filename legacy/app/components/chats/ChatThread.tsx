/**
 * @registry-id: ChatThreadComponent
 * @created: 2026-01-20T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: Chat thread component - displays messages and input editor for a channel
 * @last-fix: [2026-01-20] Replaced TipTap with simple native markdown editor
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useChatViewModel.ts => Chat ViewModel
 *   - app/lib/services/chatService.ts => Chat message types
 *   - app/components/chats/ChatInput.tsx => Chat input editor
 *   - app/components/chats/MessageBubble.tsx => Message display component
 *   - app/components/ui/** => Shadcn microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/chats/ChatDashboard.tsx => Uses ChatThread
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useChatViewModel } from '@/lib/viewmodels/useChatViewModel'
import type { ChannelWithLinks } from '@/lib/types/chats.types'
import ChatInput from './ChatInput'
import MessageBubble from './MessageBubble'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface ChatThreadProps {
  channel: ChannelWithLinks
}

export default function ChatThread({ channel }: ChatThreadProps) {
  const { messages, loading, sendMessage, updateMessage, deleteMessage, setActiveChannel, loadMessages } = useChatViewModel()
  const [editorHtml, setEditorHtml] = useState('')
  const [editorPlainText, setEditorPlainText] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [currentAttachments, setCurrentAttachments] = useState<Array<{ id: string; url: string; type: string; mimeType: string; size: number; filename?: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load messages when channel changes
  useEffect(() => {
    if (channel?._id) {
      setActiveChannel(channel._id)
    }
  }, [channel?._id, setActiveChannel])

  // Note: Auto-scroll removed - users scroll up to see older messages
  // The editor is fixed at the bottom, so new messages appear above it

  const handleSubmit = async (attachments?: Array<{ id: string; url: string; type: string; mimeType: string; size: number; filename?: string }>) => {
    if ((!editorPlainText.trim() && (!attachments || attachments.length === 0)) || loading) return

    if (editingMessageId) {
      // Update existing message
      await updateMessage(editingMessageId, {
        editorHtml,
        plainText: editorPlainText,
      })
      setEditingMessageId(null)
      setEditorHtml('')
      setEditorPlainText('')
    } else {
      // Extract mentions from markdown HTML
      const mentionIds: string[] = []
      // Match: <span class="mention" data-mention="username">@username</span>
      const mentionRegex = /data-mention="([^"]+)"/g
      let match
      while ((match = mentionRegex.exec(editorHtml)) !== null) {
        mentionIds.push(match[1])
      }
      
      // Also extract from plain text as fallback: @username
      const plainTextMentions = editorPlainText.match(/@(\w+)/g) || []
      plainTextMentions.forEach((mention) => {
        const username = mention.substring(1)
        if (!mentionIds.includes(username)) {
          mentionIds.push(username)
        }
      })

      // Extract hashtags/linked entities (basic implementation - can be enhanced)
      const linkedEntities: Array<{ type: string; entityId: string }> = []
      const hashtagRegex = /#(\w+)/g
      while ((match = hashtagRegex.exec(editorPlainText)) !== null) {
        // This is a placeholder - in real implementation, resolve hashtag to entity
        // For now, we'll skip this and let the backend handle it
      }

      await sendMessage({
        editorHtml,
        plainText: editorPlainText,
        mentionedMembers: mentionIds,
        linkedEntities,
        attachments: Array.isArray(attachments) ? attachments.map((att) => ({
          id: att.id,
          url: att.url,
          type: att.type as 'image' | 'video' | 'file',
          mimeType: att.mimeType,
          size: att.size,
          filename: att.filename,
        })) : [],
      })
      setEditorHtml('')
      setEditorPlainText('')
      setCurrentAttachments([])
    }
  }

  const handleEdit = (messageId: string) => {
    const message = messages.find((m) => m._id === messageId)
    if (message) {
      setEditingMessageId(messageId)
      setEditorHtml(message.editor_html)
      setEditorPlainText(message.plain_text)
    }
  }

  const handleDelete = async (messageId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      await deleteMessage(messageId)
    }
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditorHtml('')
    setEditorPlainText('')
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <div className="border-b bg-card/50 p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">{channel.name}</h2>
            {channel.description && (
              <p className="text-sm text-muted-foreground mt-1">{channel.description}</p>
            )}
          </div>
          {channel.linked_entities_count &&
            (channel.linked_entities_count.notes > 0 || channel.linked_entities_count.todos > 0) && (
              <div className="flex gap-2">
                {channel.linked_entities_count.notes > 0 && (
                  <Badge variant="outline">{channel.linked_entities_count.notes} notes</Badge>
                )}
                {channel.linked_entities_count.todos > 0 && (
                  <Badge variant="outline">{channel.linked_entities_count.todos} todos</Badge>
                )}
              </div>
            )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message._id}
                message={message}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={true}
                canDelete={true}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
        </div>
      </div>

      <div className="border-t p-4 bg-card/50 shrink-0">
        {editingMessageId && (
          <div className="mb-2 text-sm text-muted-foreground">
            Editing message...{' '}
            <Button
              variant="link"
              size="sm"
              onClick={handleCancelEdit}
              className="h-auto p-0 text-primary hover:text-primary/80"
            >
              Cancel
            </Button>
          </div>
        )}
        <div className="flex items-end gap-3 w-full">
          <div className="flex-1 relative w-full min-w-0">
            <ChatInput
              content={editorHtml}
              onChange={(html, plainText, attachments) => {
                setEditorHtml(html)
                setEditorPlainText(plainText)
                setCurrentAttachments(attachments || [])
              }}
              onSubmit={(html, plainText, attachments) => {
                setEditorHtml(html)
                setEditorPlainText(plainText)
                setCurrentAttachments(attachments || [])
                handleSubmit(attachments)
              }}
              placeholder="Type a message... Use @ for mentions, # for channels"
              disabled={loading}
            />
          </div>
          <Button
            onClick={() => handleSubmit(currentAttachments)}
            disabled={(!editorPlainText.trim() && currentAttachments.length === 0) || loading}
            className="h-10 px-6 shrink-0"
          >
            {editingMessageId ? 'Update' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}
