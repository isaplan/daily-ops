/**
 * @registry-id: messageService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Message API service - Message operations
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use messageService for message operations
 */

import { ApiService, type ApiResponse } from './base'

export interface Message {
  _id: string
  content: string
  channel_id?: string
  author_id?: string | { _id: string; name: string }
  created_at: string
}

export interface CreateMessageDto {
  content: string
  channel_id?: string
  author_id?: string
}

class MessageService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(channelId?: string): Promise<ApiResponse<Message[]>> {
    const query = channelId ? `?channel_id=${channelId}` : ''
    return this.get<Message[]>(`/messages${query}`)
  }

  async create(data: CreateMessageDto): Promise<ApiResponse<Message>> {
    return this.post<Message>('/messages', data)
  }

  async convertToTodo(id: string): Promise<ApiResponse<any>> {
    return this.post<any>(`/messages/${id}/convert-to-todo`, {})
  }
}

export const messageService = new MessageService()
