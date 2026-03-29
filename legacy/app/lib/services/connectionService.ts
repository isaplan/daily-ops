/**
 * @registry-id: connectionService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T15:35:00.000Z
 * @description: Connection API service - Connection management and bi-directional entity linking
 * @last-fix: [2026-01-16] Added bi-directional linking methods for Design V2
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 *   - app/lib/types/connections.ts => EntityLink, CreateEntityLinkDto, LinkedEntitiesResponse types
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use connectionService for connections
 *   ✓ app/lib/viewmodels/useConnectionViewModel.ts => Uses connectionService for bi-directional links
 */

import { ApiService, type ApiResponse } from './base'
import type {
  EntityLink,
  CreateEntityLinkDto,
  LinkedEntitiesResponse,
  EntityType,
  ConnectionQuery,
} from '@/lib/types/connections'

export interface Connection {
  _id: string
  entity_type: 'location' | 'team' | 'member'
  entity_id: string
  connected_to_type: 'location' | 'team' | 'member' | 'channel' | 'event' | 'note'
  connected_to_id: string
}

export interface CreateConnectionDto {
  entity_type: Connection['entity_type']
  entity_id: string
  connected_to_type: Connection['connected_to_type']
  connected_to_id: string
}

class ConnectionService extends ApiService {
  constructor() {
    super('/api')
  }

  async getConnections(
    entityType: Connection['entity_type'],
    entityId: string
  ): Promise<ApiResponse<Connection[]>> {
    return this.get<Connection[]>(`/${entityType}s/${entityId}/connections`)
  }

  async createConnection(data: CreateConnectionDto): Promise<ApiResponse<Connection>> {
    return this.post<Connection>(`/${data.entity_type}s/${data.entity_id}/connections`, {
      connected_to_type: data.connected_to_type,
      connected_to_id: data.connected_to_id,
    })
  }

  async deleteConnection(
    entityType: Connection['entity_type'],
    entityId: string,
    connectionId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(`/${entityType}s/${entityId}/connections/${connectionId}`)
  }

  async getLinkedEntities(query: ConnectionQuery): Promise<ApiResponse<LinkedEntitiesResponse>> {
    const params = new URLSearchParams({
      entity_type: query.entity_type,
      entity_id: query.entity_id,
      skip: (query.skip || 0).toString(),
      limit: (query.limit || 50).toString(),
    })
    if (query.include_counts) {
      params.append('include_counts', 'true')
    }
    return this.get<LinkedEntitiesResponse>(`/connections?${params.toString()}`)
  }

  async linkNoteToChannel(noteId: string, channelId: string): Promise<ApiResponse<{ source: EntityLink; target: EntityLink }>> {
    return this.post<{ source: EntityLink; target: EntityLink }>('/connections', {
      source_type: 'note',
      source_id: noteId,
      target_type: 'channel',
      target_id: channelId,
    } as CreateEntityLinkDto)
  }

  async linkChannelToNote(channelId: string, noteId: string): Promise<ApiResponse<{ source: EntityLink; target: EntityLink }>> {
    return this.linkNoteToChannel(noteId, channelId)
  }

  async linkTodoToChannel(todoId: string, channelId: string): Promise<ApiResponse<{ source: EntityLink; target: EntityLink }>> {
    return this.post<{ source: EntityLink; target: EntityLink }>('/connections', {
      source_type: 'todo',
      source_id: todoId,
      target_type: 'channel',
      target_id: channelId,
    } as CreateEntityLinkDto)
  }

  async linkNoteToTodo(noteId: string, todoId: string): Promise<ApiResponse<{ source: EntityLink; target: EntityLink }>> {
    return this.post<{ source: EntityLink; target: EntityLink }>('/connections', {
      source_type: 'note',
      source_id: noteId,
      target_type: 'todo',
      target_id: todoId,
    } as CreateEntityLinkDto)
  }

  async removeEntityLink(
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string
  ): Promise<ApiResponse<void>> {
    const params = new URLSearchParams({
      source_type: sourceType,
      source_id: sourceId,
      target_type: targetType,
    })
    return this.delete<void>(`/connections/${targetId}?${params.toString()}`)
  }
}

export const connectionService = new ConnectionService()
