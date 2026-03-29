/**
 * @registry-id: useChatViewModel
 * @created: 2026-01-20T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: ViewModel for Chat interface (MVVM pattern) - manages channels, messages, send/edit/delete
 * @last-fix: [2026-01-20] Initial implementation - chat-specific viewmodel using chatService
 * 
 * @imports-from:
 *   - app/lib/services/chatService.ts => Chat message service
 *   - app/lib/types/chats.types.ts => ChannelWithLinks type
 * 
 * @exports-to:
 *   ✓ app/components/chats/** => Components use useChatViewModel
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import { chatService, type ChatMessage } from '@/lib/services/chatService'
import type { ChannelWithLinks } from '@/lib/types/chats.types'
import type { ApiResponse } from '@/lib/services/base'

interface UseChatViewModelReturn {
  channels: ChannelWithLinks[]
  activeChannel: ChannelWithLinks | null
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  loadChannels: () => Promise<void>
  setActiveChannel: (channelId: string) => Promise<void>
  loadMessages: (channelId: string, skip?: number, limit?: number) => Promise<void>
  sendMessage: (data: {
    editorHtml: string
    plainText: string
    mentionedMembers?: string[]
    linkedEntities?: Array<{ type: string; entityId: string }>
    attachments?: Array<{ id: string; url: string; type: string; mimeType: string; size: number; filename?: string }>
  }) => Promise<ChatMessage | null>
  updateMessage: (messageId: string, data: {
    editorHtml?: string
    plainText?: string
    mentionedMembers?: string[]
    linkedEntities?: Array<{ type: string; entityId: string }>
  }) => Promise<ChatMessage | null>
  deleteMessage: (messageId: string) => Promise<boolean>
  refresh: () => Promise<void>
}

export function useChatViewModel(): UseChatViewModelReturn {
  const [channels, setChannels] = useState<ChannelWithLinks[]>([])
  const [activeChannel, setActiveChannelState] = useState<ChannelWithLinks | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const loadChannels = useCallback(async () => {
    if (loadingRef.current) return
    try {
      loadingRef.current = true
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
      loadingRef.current = false
    }
  }, [])

  const loadMessages = useCallback(async (channelId: string, skip = 0, limit = 50) => {
    if (loadingRef.current) return
    try {
      loadingRef.current = true
      setLoading(true)
      setError(null)
      const response = await chatService.getMessages(channelId, skip, limit)
      if (response.success && response.data) {
        setMessages(response.data.messages.reverse())
      } else {
        setError(response.error || 'Failed to load messages')
        setMessages([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setMessages([])
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  const setActiveChannel = useCallback(
    async (channelId: string) => {
      // Try to find channel in existing channels
      let channel = channels.find((c) => c._id === channelId)
      if (!channel) {
        // If channel not in list, reload channels first
        setLoading(true)
        try {
          const response = await fetch('/api/chats/channels')
          const data: ApiResponse<{ channels: ChannelWithLinks[]; total: number; skip: number; limit: number }> =
            await response.json()
          if (data.success && data.data) {
            setChannels(data.data.channels)
            channel = data.data.channels.find((c) => c._id === channelId)
          }
        } catch (err) {
          console.error('Failed to reload channels:', err)
        } finally {
          setLoading(false)
        }
      }
      if (channel) {
        setActiveChannelState(channel)
        await loadMessages(channelId)
      } else {
        setError(`Channel ${channelId} not found`)
      }
    },
    [channels, loadMessages]
  )

  const sendMessage = useCallback(
    async (data: {
      editorHtml: string
      plainText: string
      mentionedMembers?: string[]
      linkedEntities?: Array<{ type: string; entityId: string }>
      attachments?: Array<{ id: string; url: string; type: string; mimeType: string; size: number; filename?: string }>
    }): Promise<ChatMessage | null> => {
      if (!activeChannel) {
        setError('No active channel selected')
        return null
      }

      try {
        setError(null)
        const response = await chatService.sendMessage({
          channelId: activeChannel._id,
          editorHtml: data.editorHtml,
          plainText: data.plainText,
          mentionedMembers: data.mentionedMembers,
          linkedEntities: data.linkedEntities,
          attachments: data.attachments,
        })

        if (response.success && response.data) {
          // Refresh messages to get the new one
          await loadMessages(activeChannel._id)
          return response.data
        } else {
          setError(response.error || 'Failed to send message')
          return null
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
        setError(errorMessage)
        return null
      }
    },
    [activeChannel, loadMessages]
  )

  const updateMessage = useCallback(
    async (
      messageId: string,
      data: {
        editorHtml?: string
        plainText?: string
        mentionedMembers?: string[]
        linkedEntities?: Array<{ type: string; entityId: string }>
      }
    ): Promise<ChatMessage | null> => {
      if (!activeChannel) {
        setError('No active channel selected')
        return null
      }

      try {
        setError(null)
        const response = await chatService.updateMessage(messageId, data)

        if (response.success && response.data) {
          // Update message in local state
          setMessages((prev) =>
            prev.map((msg) => (msg._id === messageId ? response.data! : msg))
          )
          return response.data
        } else {
          setError(response.error || 'Failed to update message')
          return null
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update message'
        setError(errorMessage)
        return null
      }
    },
    [activeChannel]
  )

  const deleteMessage = useCallback(
    async (messageId: string): Promise<boolean> => {
      if (!activeChannel) {
        setError('No active channel selected')
        return false
      }

      try {
        setError(null)
        const response = await chatService.deleteMessage(messageId)

        if (response.success) {
          // Remove message from local state
          setMessages((prev) => prev.filter((msg) => msg._id !== messageId))
          return true
        } else {
          setError(response.error || 'Failed to delete message')
          return false
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete message'
        setError(errorMessage)
        return false
      }
    },
    [activeChannel]
  )

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
    sendMessage,
    updateMessage,
    deleteMessage,
    refresh,
  }
}
