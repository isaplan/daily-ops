/**
 * @registry-id: useTeamViewModel
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Team ViewModel - state management and business logic for teams
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/teamService.ts => Team API operations
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 * 
 * @exports-to:
 *   ✓ app/components/TeamList.tsx => Uses useTeamViewModel for list state
 */

'use client'

import { useCallback } from 'react'
import { teamService, type Team, type CreateTeamDto, type UpdateTeamDto } from '@/lib/services/teamService'
import { useViewModelState, useFormState } from './base'

export interface TeamFormData {
  name: string
  description: string
  location_id: string
}

const initialFormData: TeamFormData = {
  name: '',
  description: '',
  location_id: '',
}

export function useTeamViewModel() {
  const { state, setLoading, setError, setData } = useViewModelState<Team>()
  const formState = useFormState<TeamFormData>(initialFormData)

  const loadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const response = await teamService.getAll()
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError(response.error || 'Failed to load teams')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load teams')
    }
  }, [setLoading, setError, setData])

  const createTeam = useCallback(
    async (data: CreateTeamDto) => {
      setLoading(true)
      try {
        const response = await teamService.create(data)
        if (response.success) {
          await loadTeams()
          formState.resetForm()
        } else {
          setError(response.error || 'Failed to create team')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create team')
      }
    },
    [setLoading, setError, loadTeams, formState]
  )

  return {
    teams: state.data,
    loading: state.loading,
    error: state.error,
    formData: formState.formData,
    setFormData: formState.updateFormData,
    resetForm: formState.resetForm,
    loadTeams,
    createTeam,
  }
}
