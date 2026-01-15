/**
 * @registry-id: viewModelBase
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Base ViewModel utilities and patterns for state management
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/** => All ViewModels use base utilities
 */

import { useState, useCallback } from 'react'

export interface ViewModelState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

export interface FormState<T> {
  formData: T
  isDirty: boolean
  isValid: boolean
}

/**
 * Common state management utilities for ViewModels
 */
export function useViewModelState<T>() {
  const [state, setState] = useState<ViewModelState<T>>({
    data: [],
    loading: false,
    error: null,
  })

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error, loading: false }))
  }, [])

  const setData = useCallback((data: T[]) => {
    setState((prev) => ({ ...prev, data, loading: false, error: null }))
  }, [])

  const resetState = useCallback(() => {
    setState({
      data: [],
      loading: false,
      error: null,
    })
  }, [])

  return {
    state,
    setLoading,
    setError,
    setData,
    resetState,
  }
}

/**
 * Form state management helper
 */
export function useFormState<T extends Record<string, any>>(initialData: T) {
  const [formData, setFormData] = useState<T>(initialData)
  const [isDirty, setIsDirty] = useState(false)
  const [isValid, setIsValid] = useState(true)

  const updateFormData = useCallback((updates: Partial<T>) => {
    setFormData((prev) => {
      const updated = { ...prev, ...updates }
      setIsDirty(true)
      return updated
    })
  }, [])

  const resetForm = useCallback(() => {
    setFormData(initialData)
    setIsDirty(false)
    setIsValid(true)
  }, [initialData])

  return {
    formData,
    isDirty,
    isValid,
    setFormData,
    updateFormData,
    setIsValid,
    resetForm,
  }
}
