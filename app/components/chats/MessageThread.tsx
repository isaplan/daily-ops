/**
 * @registry-id: MessageThread
 * @created: 2026-01-16T16:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: Message thread component with TipTap markdown editor integration
 * @last-fix: [2026-01-20] Added MessageContent component to properly render HTML with line breaks
 * 
 * @imports-from:
 *   - app/components/ui/** => Shadcn microcomponents only
 *   - app/components/editors/EditorWrapper.tsx => EditorWrapper for message input
 *   - app/lib/types/chats.types.ts => ChannelWithLinks, Message types
 *   - app/lib/types/editor.types.ts => EditorContent types
 *   - app/lib/utils/messageParser.ts => parseMentions, renderMentions
 * 
 * @exports-to:
 *   ✓ app/components/chats/ChatsDashboard.tsx => Uses MessageThread
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import dynamic from 'next/dynamic'

const TipTapChatEditor = dynamic(() => import('@/components/editors/TipTapChatEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-24 p-3 bg-slate-800 border border-slate-700 rounded-md">
      <div className="text-slate-400">Loading editor...</div>
    </div>
  ),
})
import type { ChannelWithLinks, Message } from '@/lib/types/chats.types'
import { useAuth } from '@/lib/hooks/useAuth'
import MessageContent from './MessageContent'

interface MessageThreadProps {
  channel: ChannelWithLinks
  messages: Message[]
  loading: boolean
  onMessageSent?: () => void
}

export default function MessageThread({ channel, messages, loading, onMessageSent }: MessageThreadProps) {
  const [editorContent, setEditorContent] = useState<string>('')
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([])
  const { user } = useAuth()

  // Merge optimistic messages with real messages
  const displayMessages = [...messages, ...optimisticMessages]

  const handleSend = async () => {
    if (!editorContent) return
    
    // Extract plain text from HTML if it's HTML content
    let plainText = ''
    if (typeof editorContent === 'string') {
      if (editorContent.startsWith('<')) {
        // It's HTML, extract text
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = editorContent
        plainText = tempDiv.textContent || tempDiv.innerText || ''
      } else {
        plainText = editorContent
      }
    }
    
    if (plainText.trim().length === 0) return

    // Validate required fields before sending
    if (!channel?._id) {
      alert('Channel ID is missing')
      return
    }

    // Use the extracted plain text for display
    const messageText = plainText.trim()

    // Create optimistic message - show immediately!
    const tempId = `temp-${Date.now()}`
    const optimisticMessage: Message = {
      _id: tempId,
      channel_id: channel._id.toString(),
      content: messageText,
      author_id: user || { _id: 'temp', name: 'You' },
      timestamp: new Date().toISOString(),
    }

    // Add optimistic message immediately
    setOptimisticMessages([optimisticMessage])
    setEditorContent('') // Clear editor - must be empty string, not array

    try {
      // Ensure channelId is a string (handle ObjectId case)
      const channelId = typeof channel._id === 'string' ? channel._id : channel._id?.toString()
      
      if (!channelId) {
        alert('Invalid channel ID')
        setOptimisticMessages([]) // Remove on error
        return
      }

      // Ensure we're sending the HTML content
      const htmlContent = typeof editorContent === 'string' ? editorContent : ''
      
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          content: messageText, // Plain text for display
          editorContent: htmlContent, // HTML content for rich formatting - always send if string
          // userId is optional - API will auto-get first active member
        }),
      })

      if (response.ok) {
        // Remove optimistic message and refresh to get real one
        setOptimisticMessages([])
        onMessageSent?.()
      } else {
        // Remove optimistic message on error
        setOptimisticMessages([])
        const errorData = await response.json()
        console.error('Failed to send message:', errorData)
        alert(`Failed to send message: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      // Remove optimistic message on error
      setOptimisticMessages([])
      console.error('Failed to send message:', error)
      alert('Failed to send message. Please try again.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-white/10 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{channel.name}</h2>
            {channel.description && (
              <p className="text-sm text-slate-400 mt-1">{channel.description}</p>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          displayMessages.map((message) => {
            return (
              <Card 
                key={message._id} 
                className={`bg-slate-800/50 border-white/10 ${message._id.startsWith('temp-') ? 'opacity-70' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {typeof message.author_id === 'object' && message.author_id.name
                        ? message.author_id.name.charAt(0).toUpperCase()
                        : 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">
                          {typeof message.author_id === 'object' && message.author_id.name
                            ? message.author_id.name
                            : 'Unknown'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <MessageContent 
                        content={message.content} 
                        editorContent={message.editor_content}
                        mentions={message.mentioned_members}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <div className="border-t border-white/10 bg-slate-900/80 p-4">
        <div className="flex items-end gap-3 w-full">
          <div className="flex-1 relative w-full min-w-0">
            <TipTapChatEditor
              content={editorContent}
              onChange={(html) => {
                setEditorContent(html)
              }}
              placeholder="Type a message... Use @ for mentions, # for channels"
              onSend={handleSend}
            />
          </div>
          <Button 
            onClick={handleSend} 
            disabled={!editorContent || (typeof editorContent === 'string' && editorContent.trim().length === 0)}
            className="h-10 px-6 shrink-0"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
