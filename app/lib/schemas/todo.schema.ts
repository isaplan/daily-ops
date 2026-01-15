/**
 * @registry-id: todoSchema
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Todo Zod validation schemas
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/types/todo.types.ts => Todo types
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use schema for form validation
 */

import { z } from 'zod'

export const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
  created_by: z.string().optional(),
})

export const updateTodoSchema = createTodoSchema.partial()

export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
