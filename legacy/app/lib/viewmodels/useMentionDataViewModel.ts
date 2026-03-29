/**
 * @registry-id: useMentionDataViewModel
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-18T00:00:00.000Z
 * @description: ViewModel for fetching and filtering mention/hashtag data for BlockNote autocomplete
 * @last-fix: [2026-01-18] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/memberService.ts => Fetch members
 *   - app/lib/services/channelService.ts => Fetch channels
 *   - app/lib/services/noteService.ts => Fetch notes
 *   - app/lib/services/todoService.ts => Fetch todos
 *   - app/lib/services/eventService.ts => Fetch events
 *   - app/lib/services/decisionService.ts => Fetch decisions
 * 
 * @exports-to:
 *   ✓ app/components/editors/BlockNoteEditor.tsx => Used for suggestion menu data
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { memberService, type Member } from '@/lib/services/memberService'
import { channelService, type Channel } from '@/lib/services/channelService'
import { noteService, type Note } from '@/lib/services/noteService'
import { todoService, type Todo } from '@/lib/services/todoService'
import { eventService, type Event } from '@/lib/services/eventService'
import { decisionService, type Decision } from '@/lib/services/decisionService'

export interface MentionItem {
  id: string
  title: string
  group: string
  userId?: string
  userName?: string
}

export interface HashtagItem {
  id: string
  title: string
  group: string
  entityType: string
  entityId: string
  entityName: string
}

interface UseMentionDataViewModelReturn {
  getMentionItems: (query: string) => Promise<MentionItem[]>
  getHashtagItems: (query: string) => Promise<HashtagItem[]>
  isLoading: boolean
  error: string | null
}

export function useMentionDataViewModel(): UseMentionDataViewModelReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [membersCache, setMembersCache] = useState<Member[]>([])
  const [entitiesCache, setEntitiesCache] = useState<{
    channels: Channel[]
    notes: Note[]
    todos: Todo[]
    events: Event[]
    decisions: Decision[]
  }>({
    channels: [],
    notes: [],
    todos: [],
    events: [],
    decisions: [],
  })

  const loadMembers = useCallback(async () => {
    if (membersCache.length > 0) return
    try {
      setIsLoading(true)
      const response = await memberService.getAll({ is_active: true }, 0, 100)
      if (response.success && response.data) {
        setMembersCache(response.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setIsLoading(false)
    }
  }, [membersCache.length])

  const loadEntities = useCallback(async () => {
    if (
      entitiesCache.channels.length > 0 ||
      entitiesCache.notes.length > 0 ||
      entitiesCache.todos.length > 0 ||
      entitiesCache.events.length > 0 ||
      entitiesCache.decisions.length > 0
    ) {
      return
    }
    try {
      setIsLoading(true)
      const [channelsRes, notesRes, todosRes, eventsRes, decisionsRes] =
        await Promise.all([
          channelService.getAll({}, 0, 50),
          noteService.getAll({}, 0, 50),
          todoService.getAll({}, 0, 50),
          eventService.getAll({}, 0, 50),
          decisionService.getAll({}, 0, 50),
        ])

      setEntitiesCache({
        channels: channelsRes.success ? channelsRes.data || [] : [],
        notes: notesRes.success ? notesRes.data || [] : [],
        todos: todosRes.success ? todosRes.data || [] : [],
        events: eventsRes.success ? eventsRes.data || [] : [],
        decisions: decisionsRes.success ? decisionsRes.data || [] : [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entities')
    } finally {
      setIsLoading(false)
    }
  }, [entitiesCache])

  const getMentionItems = useCallback(
    async (query: string): Promise<MentionItem[]> => {
      await loadMembers()
      const lowerQuery = query.toLowerCase()
      return membersCache
        .filter((member) => {
          const name = member.name.toLowerCase()
          const email = member.email.toLowerCase()
          return name.includes(lowerQuery) || email.includes(lowerQuery)
        })
        .map((member) => ({
          id: member._id,
          title: member.name,
          group: 'Members',
          userId: member._id,
          userName: member.name,
        }))
    },
    [membersCache, loadMembers]
  )

  const getHashtagItems = useCallback(
    async (query: string): Promise<HashtagItem[]> => {
      await loadEntities()
      const lowerQuery = query.toLowerCase()
      const items: HashtagItem[] = []

      entitiesCache.channels
        .filter((channel) => channel.name.toLowerCase().includes(lowerQuery))
        .forEach((channel) => {
          items.push({
            id: channel._id,
            title: channel.name,
            group: 'Channels',
            entityType: 'channel',
            entityId: channel._id,
            entityName: channel.name,
          })
        })

      entitiesCache.notes
        .filter((note) => note.title.toLowerCase().includes(lowerQuery))
        .forEach((note) => {
          items.push({
            id: note._id,
            title: note.title,
            group: 'Notes',
            entityType: 'note',
            entityId: note._id,
            entityName: note.title,
          })
        })

      entitiesCache.todos
        .filter((todo) => todo.title.toLowerCase().includes(lowerQuery))
        .forEach((todo) => {
          items.push({
            id: todo._id,
            title: todo.title,
            group: 'Todos',
            entityType: 'todo',
            entityId: todo._id,
            entityName: todo.title,
          })
        })

      entitiesCache.events
        .filter((event) => event.name.toLowerCase().includes(lowerQuery))
        .forEach((event) => {
          items.push({
            id: event._id,
            title: event.name,
            group: 'Events',
            entityType: 'event',
            entityId: event._id,
            entityName: event.name,
          })
        })

      entitiesCache.decisions
        .filter((decision) => decision.title.toLowerCase().includes(lowerQuery))
        .forEach((decision) => {
          items.push({
            id: decision._id,
            title: decision.title,
            group: 'Decisions',
            entityType: 'decision',
            entityId: decision._id,
            entityName: decision.title,
          })
        })

      return items
    },
    [entitiesCache, loadEntities]
  )

  return useMemo(
    () => ({
      getMentionItems,
      getHashtagItems,
      isLoading,
      error,
    }),
    [getMentionItems, getHashtagItems, isLoading, error]
  )
}
