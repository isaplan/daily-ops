/**
 * @registry-id: todoService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Todo API service - CRUD operations for todos
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useTodoViewModel.ts => Uses todoService for API calls
 */

import { ApiService, type ApiResponse } from './base'

export interface Todo {
  _id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  priority?: 'low' | 'medium' | 'high'
  due_date?: string
  assigned_to?: string | { _id: string; name: string }
  created_by?: string | { _id: string; name: string }
  created_at: string
  updated_at: string
}

export interface TodoFilters {
  status?: string
  assigned_to?: string
  created_by?: string
}

export interface CreateTodoDto {
  title: string
  description?: string
  status?: Todo['status']
  priority?: Todo['priority']
  due_date?: string
  assigned_to?: string
  created_by?: string
}

export interface UpdateTodoDto extends Partial<CreateTodoDto> {}

class TodoService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(filters?: TodoFilters): Promise<ApiResponse<Todo[]>> {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to)
    if (filters?.created_by) params.append('created_by', filters.created_by)

    const query = params.toString()
    return this.get<Todo[]>(`/todos${query ? `?${query}` : ''}`)
  }

  async getById(id: string): Promise<ApiResponse<Todo>> {
    return this.get<Todo>(`/todos/${id}`)
  }

  async create(data: CreateTodoDto): Promise<ApiResponse<Todo>> {
    return this.post<Todo>('/todos', data)
  }

  async update(id: string, data: UpdateTodoDto): Promise<ApiResponse<Todo>> {
    return this.put<Todo>(`/todos/${id}`, data)
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/todos/${id}`)
  }
}

export const todoService = new TodoService()
