/**
 * @registry-id: useDecisionViewModel
 * @created: 2026-01-16T22:30:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Decision ViewModel - state management and business logic for decisions
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/decisionService.ts => Decision API operations
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 * 
 * @exports-to:
 *   ✓ app/components/DecisionForm.tsx => Uses useDecisionViewModel for form state
 *   ✓ app/components/DecisionList.tsx => Uses useDecisionViewModel for list state
 */

'use client'

import { useCallback } from 'react'
import { decisionService, type Decision, type CreateDecisionDto, type UpdateDecisionDto } from '@/lib/services/decisionService'
import { useViewModelState, useFormState } from './base'

export interface DecisionFormData {
  title: string
  description: string
  decision: string
  status: Decision['status']
  created_by: string
  approved_by: string
  involved_members: string[]
  location_id: string
  team_id: string
  member_id: string
}

const initialFormData: DecisionFormData = {
  title: '',
  description: '',
  decision: '',
  status: 'proposed',
  created_by: '',
  approved_by: '',
  involved_members: [],
  location_id: '',
  team_id: '',
  member_id: '',
}

export function useDecisionViewModel(initialDecision?: Decision) {
  const { state, setLoading, setError, setData } = useViewModelState<Decision>()
  const formState = useFormState<DecisionFormData>(
    initialDecision
      ? {
          title: initialDecision.title,
          description: initialDecision.description || '',
          decision: initialDecision.decision,
          status: initialDecision.status,
          created_by:
            typeof initialDecision.created_by === 'object'
              ? initialDecision.created_by._id
              : initialDecision.created_by || '',
          approved_by:
            typeof initialDecision.approved_by === 'object'
              ? initialDecision.approved_by._id
              : initialDecision.approved_by || '',
          involved_members: initialDecision.involved_members?.map((m) =>
            typeof m === 'object' ? m._id : m
          ) || [],
          location_id:
            typeof initialDecision.connected_to?.location_id === 'object'
              ? initialDecision.connected_to.location_id._id
              : initialDecision.connected_to?.location_id || '',
          team_id:
            typeof initialDecision.connected_to?.team_id === 'object'
              ? initialDecision.connected_to.team_id._id
              : initialDecision.connected_to?.team_id || '',
          member_id:
            typeof initialDecision.connected_to?.member_id === 'object'
              ? initialDecision.connected_to.member_id._id
              : initialDecision.connected_to?.member_id || '',
        }
      : initialFormData
  )

  const loadDecisions = useCallback(async (filters?: { status?: string; location_id?: string; team_id?: string; member_id?: string }, skip?: number, limit?: number) => {
    setLoading(true)
    try {
      const response = await decisionService.getAll(filters, skip, limit)
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError(response.error || 'Failed to load decisions')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load decisions')
    } finally {
      setLoading(false)
    }
  }, [setLoading, setError, setData])

  const getDecisionById = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await decisionService.getById(id)
      if (response.success && response.data) {
        setData([response.data])
      } else {
        setError(response.error || 'Failed to load decision')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load decision')
    } finally {
      setLoading(false)
    }
  }, [setLoading, setError, setData])

  const createDecision = useCallback(
    async (data: CreateDecisionDto) => {
      setLoading(true)
      try {
        const response = await decisionService.create(data)
        if (response.success) {
          await loadDecisions()
          formState.resetForm()
        } else {
          setError(response.error || 'Failed to create decision')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create decision')
      } finally {
        setLoading(false)
      }
    },
    [setLoading, setError, loadDecisions, formState]
  )

  const updateDecision = useCallback(
    async (id: string, data: UpdateDecisionDto) => {
      setLoading(true)
      try {
        const response = await decisionService.update(id, data)
        if (response.success) {
          await loadDecisions()
        } else {
          setError(response.error || 'Failed to update decision')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update decision')
      } finally {
        setLoading(false)
      }
    },
    [setLoading, setError, loadDecisions]
  )

  const deleteDecision = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        const response = await decisionService.delete(id)
        if (response.success) {
          await loadDecisions()
        } else {
          setError(response.error || 'Failed to delete decision')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete decision')
      } finally {
        setLoading(false)
      }
    },
    [setLoading, setError, loadDecisions]
  )

  return {
    decisions: state.data,
    loading: state.loading,
    error: state.error,
    formData: formState.formData,
    setFormData: formState.updateFormData,
    resetForm: formState.resetForm,
    loadDecisions,
    getDecisionById,
    createDecision,
    updateDecision,
    deleteDecision,
  }
}
