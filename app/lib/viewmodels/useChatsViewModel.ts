/**
 * @registry-id: useChatsViewModel
 * @created: 2026-01-16T15:55:00.000Z
 * @last-modified: 2026-01-16T15:55:00.000Z
 * @description: ViewModel for Chats interface (MVVM pattern)
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Chats interface
 * 
 * @imports-from:
 *   - app/lib/types/chats.types.ts => ChannelWithLinks, Message types
 * 
 * @exports-to:
 *   ✓ app/components/chats/** => Components use useChatsViewModel
 */

'use client'

import { useState, useCallback } from 'react'
import type { ChannelWithLinks, Message } from '@/lib/types/chats.types'
import type { ApiResponse } from '@/lib/services/base'

interface UseChatsViewModelReturn {
  channels: ChannelWithLinks[]
  activeChannel: ChannelWithLinks | null
  messages: Message[]
  loading: boolean
  error: string | null
  loadChannels: () => Promise<void>
  setActiveChannel: (channelId: string) => Promise<void>
  loadMessages: (channelId: string, skip?: number, limit?: number) => Promise<void>
  refresh: () => Promise<void>
}

export function useChatsViewModel(): UseChatsViewModelReturn {
  const [channels, setChannels] = useState<ChannelWithLinks[]>([])
  const [activeChannel, setActiveChannelState] = useState<ChannelWithLinks | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadChannels = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/chats/channels')
      const data: ApiResponse<{ channels: ChannelWithLinks[]; total: number; skip: number; limit: number }> =
        await response.json()
      if (data.success && data.data) {
        setChannels(data.data.channels)
      } else {
        setError(data.error || 'Failed to load channels')
        setChannels([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [])

  const setActiveChannel = useCallback(
    async (channelId: string) => {
      const channel = channels.find((c) => c._id === channelId)
      if (channel) {
        setActiveChannelState(channel)
        await loadMessages(channelId)
      }
    },
    [channels]
  )

  const loadMessages = useCallback(async (channelId: string, skip = 0, limit = 50) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/chats/messages/${channelId}?skip=${skip}&limit=${limit}`)
      const data: ApiResponse<{ messages: Message[]; total: number; skip: number; limit: number }> =
        await response.json()
      if (data.success && data.data) {
        setMessages(data.data.messages.reverse())
      } else {
        setError(data.error || 'Failed to load messages')
        setMessages([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await loadChannels()
    if (activeChannel) {
      await loadMessages(activeChannel._id)
    }
  }, [loadChannels, loadMessages, activeChannel])

  return {
    channels,
    activeChannel,
    messages,
    loading,
    error,
    loadChannels,
    setActiveChannel,
    loadMessages,
    refresh,
  }
}
