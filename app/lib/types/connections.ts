/**
 * @registry-id: ConnectionTypes
 * @created: 2026-01-15T15:30:00.000Z
 * @last-modified: 2026-01-15T15:30:00.000Z
 * @description: Type definitions for connections API responses
 * @last-fix: [2026-01-15] Initial implementation
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
