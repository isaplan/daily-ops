/**
 * @registry-id: useEventViewModel
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Event ViewModel - state management and business logic for events
 * @last-fix: [2026-01-16] Used in Phase 2 - EventForm integration with ConnectionPicker
 * 
 * @imports-from:
 *   - app/lib/services/eventService.ts => Event API operations
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 * 
 * @exports-to:
 *   ✓ app/components/EventForm.tsx => Uses useEventViewModel for form state
 *   ✓ app/components/EventList.tsx => Uses useEventViewModel for list state
 */

'use client'

import { useCallback } from 'react'
import { eventService, type Event, type CreateEventDto, type UpdateEventDto } from '@/lib/services/eventService'
import { useViewModelState, useFormState } from './base'

export interface EventFormData {
  name: string
  client_name: string
  guest_count: number
  date: string
  location_id: string
  channel_id: string
  assigned_to: string
  status: Event['status']
}

const initialFormData: EventFormData = {
  name: '',
  client_name: '',
  guest_count: 0,
  date: '',
  location_id: '',
  channel_id: '',
  assigned_to: '',
  status: 'planning',
}

export function useEventViewModel(initialEvent?: Event) {
  const { state, setLoading, setError, setData } = useViewModelState<Event>()
  const formState = useFormState<EventFormData>(
    initialEvent
      ? {
          name: initialEvent.name,
          client_name: initialEvent.client_name,
          guest_count: initialEvent.guest_count,
          date: initialEvent.date,
          location_id:
            typeof initialEvent.location_id === 'object'
              ? initialEvent.location_id._id
              : initialEvent.location_id || '',
          channel_id:
            typeof initialEvent.channel_id === 'object'
              ? initialEvent.channel_id._id
              : initialEvent.channel_id || '',
          assigned_to:
            typeof initialEvent.assigned_to === 'object'
              ? initialEvent.assigned_to._id
              : initialEvent.assigned_to || '',
          status: initialEvent.status || 'planning',
        }
      : initialFormData
  )

  const loadEvents = useCallback(async (filters?: { location_id?: string; status?: string }) => {
    setLoading(true)
    try {
      const response = await eventService.getAll(filters)
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError(response.error || 'Failed to load events')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load events')
    }
  }, [setLoading, setError, setData])

  const createEvent = useCallback(
    async (data: CreateEventDto) => {
      setLoading(true)
      try {
        const response = await eventService.create(data)
        if (response.success) {
          await loadEvents()
          formState.resetForm()
        } else {
          setError(response.error || 'Failed to create event')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create event')
      }
    },
    [setLoading, setError, loadEvents, formState]
  )

  const updateEvent = useCallback(
    async (id: string, data: UpdateEventDto) => {
      setLoading(true)
      try {
        const response = await eventService.update(id, data)
        if (response.success) {
          await loadEvents()
        } else {
          setError(response.error || 'Failed to update event')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update event')
      }
    },
    [setLoading, setError, loadEvents]
  )

  const deleteEvent = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        const response = await eventService.delete(id)
        if (response.success) {
          await loadEvents()
        } else {
          setError(response.error || 'Failed to delete event')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete event')
      }
    },
    [setLoading, setError, loadEvents]
  )

  const loadTimeline = useCallback(async (id: string) => {
    try {
      const response = await eventService.getTimeline(id)
      return response.data
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load timeline')
      return undefined
    }
  }, [setError])

  const loadInventory = useCallback(async (id: string) => {
    try {
      const response = await eventService.getInventory(id)
      return response.data
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load inventory')
      return undefined
    }
  }, [setError])

  const loadStaffing = useCallback(async (id: string) => {
    try {
      const response = await eventService.getStaffing(id)
      return response.data
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load staffing')
      return undefined
    }
  }, [setError])

  return {
    events: state.data,
    loading: state.loading,
    error: state.error,
    formData: formState.formData,
    setFormData: formState.updateFormData,
    resetForm: formState.resetForm,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    loadTimeline,
    loadInventory,
    loadStaffing,
  }
}
