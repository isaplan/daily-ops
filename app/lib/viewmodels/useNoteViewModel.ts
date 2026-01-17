/**
 * @registry-id: useNoteViewModel
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Note ViewModel - state management and business logic for notes
 * @last-fix: [2026-01-16] Used in Phase 2 - NoteForm integration with ConnectionPicker
 * 
 * @imports-from:
 *   - app/lib/services/noteService.ts => Note API operations
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 * 
 * @exports-to:
 *   ✓ app/components/NoteForm.tsx => Uses useNoteViewModel for form state
 *   ✓ app/components/NoteList.tsx => Uses useNoteViewModel for list state
 */

'use client'

import { useCallback } from 'react'
import { noteService, type Note, type CreateNoteDto, type UpdateNoteDto } from '@/lib/services/noteService'
import { useViewModelState, useFormState } from './base'

export interface NoteFormData {
  title: string
  content: string
  location_id: string
  team_id: string
  member_id: string
  tags: string
  is_pinned: boolean
}

const initialFormData: NoteFormData = {
  title: '',
  content: '',
  location_id: '',
  team_id: '',
  member_id: '',
  tags: '',
  is_pinned: false,
}

export function useNoteViewModel(initialNote?: Note) {
  const { state, setLoading, setError, setData } = useViewModelState<Note>()
  const formState = useFormState<NoteFormData>(
    initialNote
      ? {
          title: initialNote.title,
          content: initialNote.content,
          location_id:
            typeof initialNote.connected_to?.location_id === 'object'
              ? initialNote.connected_to.location_id._id
              : initialNote.connected_to?.location_id || '',
          team_id:
            typeof initialNote.connected_to?.team_id === 'object'
              ? initialNote.connected_to.team_id._id
              : initialNote.connected_to?.team_id || '',
          member_id:
            typeof initialNote.connected_to?.member_id === 'object'
              ? initialNote.connected_to.member_id._id
              : initialNote.connected_to?.member_id || '',
          tags: (initialNote.tags || []).join(', '),
          is_pinned: initialNote.is_pinned || false,
        }
      : initialFormData
  )

  const loadNotes = useCallback(async (filters?: { location_id?: string; team_id?: string; member_id?: string; archived?: boolean; viewing_member_id?: string }) => {
    setLoading(true)
    try {
      const response = await noteService.getAll(filters)
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError(response.error || 'Failed to load notes')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load notes')
    }
  }, [setLoading, setError, setData])

  const createNote = useCallback(
    async (data: CreateNoteDto) => {
      setLoading(true)
      try {
        const response = await noteService.create(data)
        if (response.success) {
          await loadNotes()
          formState.resetForm()
        } else {
          setError(response.error || 'Failed to create note')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create note')
      }
    },
    [setLoading, setError, loadNotes, formState]
  )

  const updateNote = useCallback(
    async (id: string, data: UpdateNoteDto) => {
      setLoading(true)
      try {
        const response = await noteService.update(id, data)
        if (response.success) {
          await loadNotes()
        } else {
          setError(response.error || 'Failed to update note')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update note')
      }
    },
    [setLoading, setError, loadNotes]
  )

  const deleteNote = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        const response = await noteService.delete(id)
        if (response.success) {
          await loadNotes()
        } else {
          setError(response.error || 'Failed to delete note')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete note')
      }
    },
    [setLoading, setError, loadNotes]
  )

  const parseTodos = useCallback(async (id: string) => {
    try {
      const response = await noteService.parseTodos(id)
      return response.data
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to parse todos')
      return undefined
    }
  }, [setError])

  const loadMembers = useCallback(async (id: string) => {
    try {
      const response = await noteService.getMembers(id)
      return response.data
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load members')
      return undefined
    }
  }, [setError])

  return {
    notes: state.data,
    loading: state.loading,
    error: state.error,
    formData: formState.formData,
    setFormData: formState.updateFormData,
    resetForm: formState.resetForm,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    parseTodos,
    loadMembers,
  }
}
