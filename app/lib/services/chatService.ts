/**
 * @registry-id: chatService
 * @created: 2026-01-20T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: Chat message API service - CRUD operations for chat messages with TipTap content
 * @last-fix: [2026-01-20] Initial implementation - chat-specific message service
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useChatViewModel.ts => Uses chatService for API calls
 */

import { ApiService, type ApiResponse } from './base'

export interface ChatMessage {
  _id: string
  channel_id: string
  author_id: string | { _id: string; name: string; email?: string }
  
  editor_html: string
  plain_text: string
  
  mentioned_members?: string[]
  linked_entities?: Array<{
    type: 'note' | 'channel' | 'todo' | 'decision' | 'event'
    id: string
    title?: string
    name?: string
    slug?: string
  }>
  
  attachments?: Array<{
    id: string
    url: string
    type: 'image' | 'video' | 'file'
    mime_type: string
    size: number
    filename?: string
  }>
  
  timestamp: string
  edited_at?: string
  is_deleted: boolean
  reactions?: Record<string, string[]>
  
  thread_count?: number
  is_thread_starter?: boolean
}

export interface SendMessageDto {
  channelId: string
  editorHtml: string
  plainText: string
  mentionedMembers?: string[]
  linkedEntities?: Array<{
    type: 'note' | 'channel' | 'todo' | 'decision' | 'event'
    entityId: string
  }>
  attachments?: Array<{
    id: string
    url: string
    type: 'image' | 'video' | 'file'
    mimeType: string
    size: number
    filename?: string
  }>
}

export interface UpdateMessageDto {
  editorHtml?: string
  plainText?: string
  mentionedMembers?: string[]
  linkedEntities?: Array<{
    type: 'note' | 'channel' | 'todo' | 'decision' | 'event'
    entityId: string
  }>
}

export interface ChatMessageFilters {
  channelId: string
  skip?: number
  limit?: number
}

class ChatService extends ApiService {
  constructor() {
    super('/api')
  }

  async getMessages(
    channelId: string,
    skip?: number,
    limit?: number
  ): Promise<ApiResponse<{ messages: ChatMessage[]; total: number; skip: number; limit: number }>> {
    const params = new URLSearchParams()
    params.append('channelId', channelId)
    if (skip !== undefined) params.append('skip', skip.toString())
    if (limit !== undefined) params.append('limit', limit.toString())

    return this.get<{ messages: ChatMessage[]; total: number; skip: number; limit: number }>(
      `/chats/messages/${channelId}?${params.toString()}`
    )
  }

  async sendMessage(data: SendMessageDto): Promise<ApiResponse<ChatMessage>> {
    return this.post<ChatMessage>('/chats/messages/send', data)
  }

  async updateMessage(messageId: string, data: UpdateMessageDto): Promise<ApiResponse<ChatMessage>> {
    return this.put<ChatMessage>(`/chats/message/${messageId}`, data)
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/chats/message/${messageId}`)
  }
}

export const chatService = new ChatService()
