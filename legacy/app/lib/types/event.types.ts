/**
 * @registry-id: eventTypes
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Event type definitions - DTOs, filters, form data
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/eventService.ts => Uses Event types
 *   ✓ app/lib/viewmodels/useEventViewModel.ts => Uses Event types
 *   ✓ app/components/EventForm.tsx => Uses Event types
 */

export type EventStatus = 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export interface Event {
  _id: string
  name: string
  client_name: string
  guest_count: number
  date: string
  location_id?: string | { _id: string; name: string }
  channel_id?: string | { _id: string; name: string }
  assigned_to?: string | { _id: string; name: string }
  status?: EventStatus
  sections?: Array<{
    title: string
    items: Array<{
      name: string
      portion_count: number
      prep_time_minutes?: number
      dietary_restrictions?: string[]
    }>
  }>
  timeline?: Array<{
    time: string
    activity: string
    assigned_to?: string
    status: 'pending' | 'in_progress' | 'completed'
  }>
  inventory?: Array<{
    item_name: string
    quantity: number
    unit: string
    status: 'ordered' | 'received' | 'prepared'
  }>
  staffing?: Array<{
    member_id: string
    role: string
    start_time: string
    end_time: string
    confirmed: boolean
  }>
  estimated_labor_cost?: number
  actual_labor_cost?: number
  revenue?: number
  estimated_profit?: number
  created_by?: { _id: string; name: string }
  created_at: string
}

export interface CreateEventDto {
  name: string
  client_name: string
  guest_count: number
  date: string
  location_id?: string
  channel_id?: string
  assigned_to?: string
  status?: EventStatus
  sections?: Event['sections']
  timeline?: Event['timeline']
  inventory?: Event['inventory']
  staffing?: Event['staffing']
  estimated_labor_cost?: number
  actual_labor_cost?: number
  revenue?: number
  estimated_profit?: number
  created_by?: string
}

export interface UpdateEventDto extends Partial<CreateEventDto> {}

export interface EventFilters {
  location_id?: string
  status?: string
  date_from?: string
  date_to?: string
}

export interface EventFormData {
  name: string
  client_name: string
  guest_count: number
  date: string
  location_id: string
  channel_id: string
  assigned_to: string
  status: EventStatus
}
