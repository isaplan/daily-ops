/**
 * @registry-id: eventService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Event API service - CRUD operations for events
 * @last-fix: [2026-01-16] Added pagination support (skip/limit) to getAll method
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useEventViewModel.ts => Uses eventService for API calls
 */

import { ApiService, type ApiResponse } from './base'

export interface Event {
  _id: string
  name: string
  client_name: string
  guest_count: number
  date: string
  location_id?: string | { _id: string; name: string }
  channel_id?: string | { _id: string; name: string }
  assigned_to?: string | { _id: string; name: string }
  status?: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
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

export interface EventFilters {
  location_id?: string
  status?: string
  date_from?: string
  date_to?: string
}

export interface CreateEventDto {
  name: string
  client_name: string
  guest_count: number
  date: string
  location_id?: string
  channel_id?: string
  assigned_to?: string
  status?: Event['status']
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

class EventService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(filters?: EventFilters, skip?: number, limit?: number): Promise<ApiResponse<Event[]>> {
    const params = new URLSearchParams()
    if (filters?.location_id) params.append('location_id', filters.location_id)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.date_from) params.append('date_from', filters.date_from)
    if (filters?.date_to) params.append('date_to', filters.date_to)
    if (skip !== undefined) params.append('skip', skip.toString())
    if (limit !== undefined) params.append('limit', limit.toString())

    const query = params.toString()
    return this.get<Event[]>(`/events${query ? `?${query}` : ''}`)
  }

  async getById(id: string): Promise<ApiResponse<Event>> {
    return this.get<Event>(`/events/${id}`)
  }

  async create(data: CreateEventDto): Promise<ApiResponse<Event>> {
    return this.post<Event>('/events', data)
  }

  async update(id: string, data: UpdateEventDto): Promise<ApiResponse<Event>> {
    return this.put<Event>(`/events/${id}`, data)
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/events/${id}`)
  }

  async getTimeline(id: string): Promise<ApiResponse<Event['timeline']>> {
    return this.get<Event['timeline']>(`/events/${id}/timeline`)
  }

  async getInventory(id: string): Promise<ApiResponse<Event['inventory']>> {
    return this.get<Event['inventory']>(`/events/${id}/inventory`)
  }

  async getStaffing(id: string): Promise<ApiResponse<Event['staffing']>> {
    return this.get<Event['staffing']>(`/events/${id}/staffing`)
  }
}

export const eventService = new EventService()
