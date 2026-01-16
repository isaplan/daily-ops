/**
 * @registry-id: useConnectionViewModel
 * @created: 2026-01-16T15:40:00.000Z
 * @last-modified: 2026-01-16T15:40:00.000Z
 * @description: ViewModel for managing bi-directional entity links (MVVM pattern)
 * @last-fix: [2026-01-16] Initial implementation for Design V2 bi-directional linking
 * 
 * @imports-from:
 *   - app/lib/services/connectionService.ts => connectionService for API calls
 *   - app/lib/types/connections.ts => EntityType, LinkedEntityDisplay types
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use useConnectionViewModel for entity linking
 */

'use client'

import { useState, useCallback } from 'react'
import { connectionService } from '@/lib/services/connectionService'
import type { EntityType, LinkedEntityDisplay, ConnectionQuery } from '@/lib/types/connections'
import type { ApiResponse } from '@/lib/services/base'

interface UseConnectionViewModelReturn {
  linkedEntities: LinkedEntityDisplay[]
  loading: boolean
  error: string | null
  getLinkedEntities: (query: ConnectionQuery) => Promise<void>
  createLink: (
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string
  ) => Promise<boolean>
  removeLink: (
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string
  ) => Promise<boolean>
  refresh: () => Promise<void>
}

let currentQuery: ConnectionQuery | null = null

export function useConnectionViewModel(): UseConnectionViewModelReturn {
  const [linkedEntities, setLinkedEntities] = useState<LinkedEntityDisplay[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getLinkedEntities = useCallback(async (query: ConnectionQuery) => {
    try {
      setLoading(true)
      setError(null)
      currentQuery = query
      const response: ApiResponse<{ linked_entities: LinkedEntityDisplay[]; total: number; skip: number; limit: number }> =
        await connectionService.getLinkedEntities(query)
      if (response.success && response.data) {
        setLinkedEntities(response.data.linked_entities)
      } else {
        setError(response.error || 'Failed to fetch linked entities')
        setLinkedEntities([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLinkedEntities([])
    } finally {
      setLoading(false)
    }
  }, [])

  const createLink = useCallback(
    async (
      sourceType: EntityType,
      sourceId: string,
      targetType: EntityType,
      targetId: string
    ): Promise<boolean> => {
      try {
        setLoading(true)
        setError(null)
        let response: ApiResponse<{ source: { type: EntityType; id: string }; target: { type: EntityType; id: string } }>

        if (sourceType === 'note' && targetType === 'channel') {
          response = await connectionService.linkNoteToChannel(sourceId, targetId)
        } else if (sourceType === 'todo' && targetType === 'channel') {
          response = await connectionService.linkTodoToChannel(sourceId, targetId)
        } else if (sourceType === 'note' && targetType === 'todo') {
          response = await connectionService.linkNoteToTodo(sourceId, targetId)
        } else if (sourceType === 'channel' && targetType === 'note') {
          response = await connectionService.linkChannelToNote(sourceId, targetId)
        } else {
          setError('Unsupported link type combination')
          return false
        }

        if (response.success) {
          if (currentQuery) {
            await getLinkedEntities(currentQuery)
          }
          return true
        } else {
          setError(response.error || 'Failed to create link')
          return false
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        return false
      } finally {
        setLoading(false)
      }
    },
    [getLinkedEntities]
  )

  const removeLink = useCallback(
    async (
      sourceType: EntityType,
      sourceId: string,
      targetType: EntityType,
      targetId: string
    ): Promise<boolean> => {
      try {
        setLoading(true)
        setError(null)
        const response = await connectionService.removeEntityLink(sourceType, sourceId, targetType, targetId)
        if (response.success) {
          if (currentQuery) {
            await getLinkedEntities(currentQuery)
          }
          return true
        } else {
          setError(response.error || 'Failed to remove link')
          return false
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        return false
      } finally {
        setLoading(false)
      }
    },
    [getLinkedEntities]
  )

  const refresh = useCallback(async () => {
    if (currentQuery) {
      await getLinkedEntities(currentQuery)
    }
  }, [getLinkedEntities])

  return {
    linkedEntities,
    loading,
    error,
    getLinkedEntities,
    createLink,
    removeLink,
    refresh,
  }
}
