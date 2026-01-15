/**
 * @registry-id: useChannelViewModel
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Channel ViewModel - state management and business logic for channels
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/channelService.ts => Channel API operations
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 * 
 * @exports-to:
 *   ✓ app/components/ChannelForm.tsx => Uses useChannelViewModel for form state
 *   ✓ app/components/ChannelList.tsx => Uses useChannelViewModel for list state
 */

'use client'

import { useCallback, useEffect } from 'react'
import { channelService, type Channel, type CreateChannelDto, type UpdateChannelDto } from '@/lib/services/channelService'
import { useViewModelState, useFormState } from './base'

export interface ChannelFormData {
  name: string
  description: string
  type: string
  location_id: string
  team_id: string
  member_id: string
  members: string[]
}

const initialFormData: ChannelFormData = {
  name: '',
  description: '',
  type: 'general',
  location_id: '',
  team_id: '',
  member_id: '',
  members: [],
}

export function useChannelViewModel(initialChannel?: Channel) {
  const { state, setLoading, setError, setData, resetState } = useViewModelState<Channel>()
  const formState = useFormState<ChannelFormData>(
    initialChannel
      ? {
          name: initialChannel.name,
          description: initialChannel.description || '',
          type: initialChannel.type,
          location_id:
            typeof initialChannel.connected_to?.location_id === 'object'
              ? initialChannel.connected_to.location_id._id
              : initialChannel.connected_to?.location_id || '',
          team_id:
            typeof initialChannel.connected_to?.team_id === 'object'
              ? initialChannel.connected_to.team_id._id
              : initialChannel.connected_to?.team_id || '',
          member_id:
            typeof initialChannel.connected_to?.member_id === 'object'
              ? initialChannel.connected_to.member_id._id
              : initialChannel.connected_to?.member_id || '',
          members: initialChannel.members?.map((m) => m._id) || [],
        }
      : initialFormData
  )

  const loadChannels = useCallback(async () => {
    setLoading(true)
    try {
      const response = await channelService.getAll()
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError(response.error || 'Failed to load channels')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load channels')
    }
  }, [setLoading, setError, setData])

  const createChannel = useCallback(
    async (data: CreateChannelDto) => {
      setLoading(true)
      try {
        const response = await channelService.create(data)
        if (response.success) {
          await loadChannels()
          formState.resetForm()
        } else {
          setError(response.error || 'Failed to create channel')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create channel')
      }
    },
    [setLoading, setError, loadChannels, formState]
  )

  const updateChannel = useCallback(
    async (id: string, data: UpdateChannelDto) => {
      setLoading(true)
      try {
        const response = await channelService.update(id, data)
        if (response.success) {
          await loadChannels()
        } else {
          setError(response.error || 'Failed to update channel')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update channel')
      }
    },
    [setLoading, setError, loadChannels]
  )

  const deleteChannel = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        const response = await channelService.delete(id)
        if (response.success) {
          await loadChannels()
        } else {
          setError(response.error || 'Failed to delete channel')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete channel')
      }
    },
    [setLoading, setError, loadChannels]
  )

  return {
    channels: state.data,
    loading: state.loading,
    error: state.error,
    formData: formState.formData,
    setFormData: formState.updateFormData,
    resetForm: formState.resetForm,
    loadChannels,
    createChannel,
    updateChannel,
    deleteChannel,
  }
}
