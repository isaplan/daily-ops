/**
 * @registry-id: MessageThread
 * @created: 2026-01-16T16:00:00.000Z
 * @last-modified: 2026-01-16T16:00:00.000Z
 * @description: Message thread component using shadcn microcomponents only
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Chats interface
 * 
 * @imports-from:
 *   - app/components/ui/** => Shadcn microcomponents only
 *   - app/lib/types/chats.types.ts => ChannelWithLinks, Message types
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChannelWithLinks, Message } from '@/lib/types/chats.types'
import { parseMentions, renderMentions } from '@/lib/utils/messageParser'

interface MessageThreadProps {
  channel: ChannelWithLinks
  messages: Message[]
  loading: boolean
}

export default function MessageThread({ channel, messages, loading }: MessageThreadProps) {
  const [messageText, setMessageText] = useState('')

  const handleSend = async () => {
    if (!messageText.trim()) return
    const mentions = parseMentions(messageText)
    setMessageText('')
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
          messages.map((message) => {
            const mentions = parseMentions(message.content)
            const renderedParts = renderMentions(message.content, mentions)

            return (
              <Card key={message._id} className="bg-slate-800/50 border-white/10">
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
                      <div className="text-slate-200">
                        {renderedParts.map((part, idx) => {
                          if (typeof part === 'string') {
                            return <span key={idx}>{part}</span>
                          }
                          return (
                            <Button
                              key={idx}
                              variant="link"
                              className="h-auto p-0 text-blue-400 hover:text-blue-300"
                              asChild
                            >
                              <Link
                                href={
                                  part.type === 'note'
                                    ? `/notes/${part.slug || part.id}`
                                    : part.type === 'todo'
                                    ? `/todos`
                                    : `/channels/${part.id}`
                                }
                              >
                                {part.original}
                              </Link>
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <div className="border-t border-white/10 bg-slate-900/80 p-4">
        <div className="flex gap-2">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message... Use @note:slug, @todo:id, @channel:name to link"
            className="flex-1 bg-slate-800/50 border-white/10 text-white resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button onClick={handleSend} disabled={!messageText.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
