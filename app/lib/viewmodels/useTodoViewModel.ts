/**
 * @registry-id: useTodoViewModel
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Todo ViewModel - state management and business logic for todos
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/todoService.ts => Todo API operations
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use useTodoViewModel for todo operations
 */

'use client'

import { useCallback } from 'react'
import { todoService, type Todo, type CreateTodoDto, type UpdateTodoDto } from '@/lib/services/todoService'
import { useViewModelState } from './base'

export function useTodoViewModel() {
  const { state, setLoading, setError, setData } = useViewModelState<Todo>()

  const loadTodos = useCallback(async (filters?: { status?: string; assigned_to?: string; created_by?: string }) => {
    setLoading(true)
    try {
      const response = await todoService.getAll(filters)
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError(response.error || 'Failed to load todos')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load todos')
    }
  }, [setLoading, setError, setData])

  const createTodo = useCallback(
    async (data: CreateTodoDto) => {
      setLoading(true)
      try {
        const response = await todoService.create(data)
        if (response.success) {
          await loadTodos()
        } else {
          setError(response.error || 'Failed to create todo')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create todo')
      }
    },
    [setLoading, setError, loadTodos]
  )

  const updateTodo = useCallback(
    async (id: string, data: UpdateTodoDto) => {
      setLoading(true)
      try {
        const response = await todoService.update(id, data)
        if (response.success) {
          await loadTodos()
        } else {
          setError(response.error || 'Failed to update todo')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update todo')
      }
    },
    [setLoading, setError, loadTodos]
  )

  const deleteTodo = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        const response = await todoService.delete(id)
        if (response.success) {
          await loadTodos()
        } else {
          setError(response.error || 'Failed to delete todo')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete todo')
      }
    },
    [setLoading, setError, loadTodos]
  )

  return {
    todos: state.data,
    loading: state.loading,
    error: state.error,
    loadTodos,
    createTodo,
    updateTodo,
    deleteTodo,
  }
}
