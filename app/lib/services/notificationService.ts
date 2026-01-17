/**
 * @registry-id: notificationService
 * @created: 2026-01-16T22:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Notification API service - type-safe notification operations
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/components/layouts/DesignV2TopNav.tsx => Notification UI uses notificationService
 */

import { ApiService, type ApiResponse } from './base'

export interface Notification {
  _id: string
  member_id: string
  type: string
  title: string
  message: string
  read: boolean
  read_at?: string
  created_at: string
  metadata?: Record<string, unknown>
}

export interface NotificationFilters {
  member_id?: string
  read?: boolean
  skip?: number
  limit?: number
}

export interface NotificationResponse {
  notifications: Notification[]
  total: number
  skip: number
  limit: number
}

class NotificationService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(filters?: NotificationFilters): Promise<ApiResponse<NotificationResponse>> {
    const params = new URLSearchParams({
      skip: (filters?.skip || 0).toString(),
      limit: (filters?.limit || 50).toString(),
    })

    if (filters?.member_id) {
      params.append('member_id', filters.member_id)
    }

    if (filters?.read !== undefined) {
      params.append('read', filters.read.toString())
    }

    return this.get<NotificationResponse>(`/notifications?${params.toString()}`)
  }

  async markAsRead(notificationId: string): Promise<ApiResponse<Notification>> {
    return this.put<Notification>('/notifications', {
      notification_id: notificationId,
      read: true,
    })
  }

  async markAsUnread(notificationId: string): Promise<ApiResponse<Notification>> {
    return this.put<Notification>('/notifications', {
      notification_id: notificationId,
      read: false,
    })
  }

  async delete(notificationId: string): Promise<ApiResponse<void>> {
    const params = new URLSearchParams({ id: notificationId })
    return this.delete<void>(`/notifications?${params.toString()}`)
  }
}

export const notificationService = new NotificationService()
