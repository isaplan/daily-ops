/**
 * @registry-id: todoTypes
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Todo type definitions - DTOs, filters, form data
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/todoService.ts => Uses Todo types
 *   ✓ app/lib/viewmodels/useTodoViewModel.ts => Uses Todo types
 *   ✓ app/components/** => Components use Todo types
 */

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

export interface TodoFilters {
  status?: string
  assigned_to?: string
  created_by?: string
}
