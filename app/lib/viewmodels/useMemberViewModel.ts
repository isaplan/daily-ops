/**
 * @registry-id: useMemberViewModel
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T16:25:00.000Z
 * @description: Member ViewModel - state management and business logic for members
 * @last-fix: [2026-01-16] Added workspace filter support for location-based filtering
 * 
 * @imports-from:
 *   - app/lib/services/memberService.ts => Member API operations
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 *   - app/lib/workspaceContext.tsx => Workspace filter
 * 
 * @exports-to:
 *   ✓ app/components/MemberList.tsx => Uses useMemberViewModel for list/form state
 */

'use client'

import { useCallback } from 'react'
import { memberService, type Member, type CreateMemberDto, type UpdateMemberDto, type MemberFilters } from '@/lib/services/memberService'
import { useViewModelState, useFormState } from './base'
import { useWorkspace } from '@/lib/workspaceContext'

export interface MemberFormData {
  name: string
  email: string
  slack_username: string
  location_id: string
  team_id: string
}

const initialFormData: MemberFormData = {
  name: '',
  email: '',
  slack_username: '',
  location_id: '',
  team_id: '',
}

export function useMemberViewModel() {
  const { state, setLoading, setError, setData } = useViewModelState<Member>()
  const formState = useFormState<MemberFormData>(initialFormData)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await memberService.getAll()
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError(response.error || 'Failed to load members')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load members')
    }
  }, [setLoading, setError, setData])

  const createMember = useCallback(
    async (data: CreateMemberDto) => {
      setLoading(true)
      try {
        const response = await memberService.create(data)
        if (response.success) {
          await loadMembers()
          formState.resetForm()
        } else {
          setError(response.error || 'Failed to create member')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create member')
      }
    },
    [setLoading, setError, loadMembers, formState]
  )

  const updateMember = useCallback(
    async (id: string, data: UpdateMemberDto) => {
      setLoading(true)
      try {
        const response = await memberService.update(id, data)
        if (response.success) {
          await loadMembers()
        } else {
          setError(response.error || 'Failed to update member')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update member')
      }
    },
    [setLoading, setError, loadMembers]
  )

  const deleteMember = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        const response = await memberService.delete(id)
        if (response.success) {
          await loadMembers()
        } else {
          setError(response.error || 'Failed to delete member')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete member')
      }
    },
    [setLoading, setError, loadMembers]
  )

  return {
    members: state.data,
    loading: state.loading,
    error: state.error,
    formData: formState.formData,
    setFormData: formState.updateFormData,
    resetForm: formState.resetForm,
    loadMembers,
    createMember,
    updateMember,
    deleteMember,
  }
}
