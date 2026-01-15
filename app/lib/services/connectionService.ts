/**
 * @registry-id: connectionService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Connection API service - Connection management
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use connectionService for connections
 */

import { ApiService, type ApiResponse } from './base'

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
}

export const connectionService = new ConnectionService()
