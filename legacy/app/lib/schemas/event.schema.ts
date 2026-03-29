/**
 * @registry-id: eventSchema
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Event Zod validation schemas
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/types/event.types.ts => Event types
 * 
 * @exports-to:
 *   ✓ app/components/EventForm.tsx => Uses schema for form validation
 */

import { z } from 'zod'

export const createEventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  client_name: z.string().min(1, 'Client name is required'),
  guest_count: z.number().min(1, 'Guest count must be at least 1'),
  date: z.string().min(1, 'Date is required'),
  location_id: z.string().optional(),
  channel_id: z.string().optional(),
  assigned_to: z.string().optional(),
  status: z.enum(['planning', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  sections: z.array(z.object({
    title: z.string(),
    items: z.array(z.object({
      name: z.string(),
      portion_count: z.number(),
      prep_time_minutes: z.number().optional(),
      dietary_restrictions: z.array(z.string()).optional(),
    })),
  })).optional(),
  timeline: z.array(z.object({
    time: z.string(),
    activity: z.string(),
    assigned_to: z.string().optional(),
    status: z.enum(['pending', 'in_progress', 'completed']),
  })).optional(),
  inventory: z.array(z.object({
    item_name: z.string(),
    quantity: z.number(),
    unit: z.string(),
    status: z.enum(['ordered', 'received', 'prepared']),
  })).optional(),
  staffing: z.array(z.object({
    member_id: z.string(),
    role: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    confirmed: z.boolean(),
  })).optional(),
  estimated_labor_cost: z.number().optional(),
  actual_labor_cost: z.number().optional(),
  revenue: z.number().optional(),
  estimated_profit: z.number().optional(),
  created_by: z.string().optional(),
})

export const updateEventSchema = createEventSchema.partial()

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
