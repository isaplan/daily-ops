/**
 * @registry-id: chatsTypes
 * @created: 2026-01-16T15:55:00.000Z
 * @last-modified: 2026-01-16T21:00:00.000Z
 * @description: Type definitions for Chats interface
 * @last-fix: [2026-01-16] Added messages_count to ChannelWithLinks for popularity sorting
 * 
 * @exports-to:
 *   ✓ app/lib/services/channelService.ts => Uses Chat types
 *   ✓ app/lib/viewmodels/useChatsViewModel.ts => Uses Chat types
 *   ✓ app/api/chats/** => API routes use Chat types
 */

import type { Channel } from '@/lib/types/channel.types'

export interface Message {
  _id: string
  channel_id: string
  content: string
  editor_content?: string | Array<Record<string, unknown>> // HTML string (TipTap) or BlockNote format
  attachments?: Array<{
    id: string
    url: string
    filename: string
    mimeType: string
    size: number
  }>
  author_id: string | { _id: string; name: string; email?: string }
  timestamp: string
  mentioned_members?: string[]
  mentions?: Array<{
    type: 'note' | 'todo' | 'channel'
    id: string
    slug?: string
  }>
}

export interface ChannelWithLinks extends Channel {
  linked_entities_count?: {
    notes: number
    todos: number
  }
  messages_count?: number
  unread_count?: number
}

export interface ChatsDashboardData {
  channels: ChannelWithLinks[]
  active_channel?: ChannelWithLinks
  messages: Message[]
  total_messages: number
}
