/**
 * @registry-id: collaborationService
 * @created: 2026-01-16T15:45:00.000Z
 * @last-modified: 2026-01-16T15:45:00.000Z
 * @description: Collaboration API service - Dashboard data aggregation (MVVM Service Layer)
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Collaboration dashboard
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 *   - app/lib/types/collaboration.types.ts => CollaborationDashboardData, CollaborationFilters types
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useCollaborationViewModel.ts => Uses collaborationService
 */

import { ApiService, type ApiResponse } from './base'
import type { CollaborationDashboardData, CollaborationFilters, CollaborationPagination } from '@/lib/types/collaboration.types'

class CollaborationService extends ApiService {
  constructor() {
    super('/api')
  }

  async getDashboardData(
    filters?: CollaborationFilters,
    pagination?: CollaborationPagination
  ): Promise<ApiResponse<CollaborationDashboardData>> {
    const params = new URLSearchParams()
    if (filters?.location_id) {
      params.append('location_id', filters.location_id)
    }
    if (filters?.team_id) {
      params.append('team_id', filters.team_id)
    }
    if (filters?.member_id) {
      params.append('member_id', filters.member_id)
    }
    if (filters?.archived !== undefined) {
      params.append('archived', filters.archived.toString())
    }
    if (pagination) {
      params.append('skip', pagination.skip.toString())
      params.append('limit', pagination.limit.toString())
    }
    return this.get<CollaborationDashboardData>(`/collaboration/dashboard?${params.toString()}`)
  }
}

export const collaborationService = new CollaborationService()
