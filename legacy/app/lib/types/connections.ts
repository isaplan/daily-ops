/**
 * @registry-id: ConnectionTypes
 * @created: 2026-01-15T15:30:00.000Z
 * @last-modified: 2026-01-16T15:30:00.000Z
 * @description: Type definitions for connections API responses and bi-directional entity linking
 * @last-fix: [2026-01-16] Added bi-directional linking types for Design V2
 * 
 * @exports-to:
 *   ✓ app/lib/services/connectionService.ts => Uses EntityLink, ConnectionQuery types
 *   ✓ app/lib/viewmodels/useConnectionViewModel.ts => Uses LinkedEntityDisplay type
 *   ✓ app/api/connections/** => API routes use connection types
 */

import type { INote } from '@/models/Note';
import type { ITodo } from '@/models/Todo';
import type { IDecision } from '@/models/Decision';
import type { IChannel } from '@/models/Channel';

export interface ConnectionsResponse {
  details: {
    notes: INote[];
    todos: ITodo[];
    decisions: IDecision[];
    channels: IChannel[];
  };
  summary: {
    total_notes: number;
    total_todos: number;
    total_decisions: number;
    total_channels: number;
  };
}

export type EntityType = 'note' | 'channel' | 'todo' | 'decision' | 'event';

export interface EntityLink {
  type: EntityType;
  id: string;
  _id?: string;
}

export interface CreateEntityLinkDto {
  source_type: EntityType;
  source_id: string;
  target_type: EntityType;
  target_id: string;
}

export interface ConnectionQuery {
  entity_type: EntityType;
  entity_id: string;
  include_counts?: boolean;
  skip?: number;
  limit?: number;
}

export interface LinkedEntityDisplay {
  type: EntityType;
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  status?: string;
  count?: number;
}

export interface LinkedEntitiesResponse {
  linked_entities: LinkedEntityDisplay[];
  total: number;
  skip: number;
  limit: number;
}
