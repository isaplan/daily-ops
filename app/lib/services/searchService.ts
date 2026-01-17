/**
 * @registry-id: searchService
 * @created: 2026-01-16T22:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Search API service - search across entities with type-safe responses
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useSearchViewModel.ts => Uses searchService for search operations
 *   ✓ app/components/layouts/DesignV2TopNav.tsx => Search UI uses searchService
 */

import { ApiService, type ApiResponse } from './base'
import type { SearchResult, SearchResponse, SearchFilters } from '@/lib/types/search.types'

export type { SearchResult, SearchResponse, SearchFilters }

class SearchService extends ApiService {
  constructor() {
    super('/api')
  }

  async search(filters: SearchFilters): Promise<ApiResponse<SearchResponse>> {
    const params = new URLSearchParams({
      q: filters.q,
      skip: (filters.skip || 0).toString(),
      limit: (filters.limit || 50).toString(),
    })

    if (filters.types && filters.types.length > 0) {
      params.append('types', filters.types.join(','))
    }

    return this.get<SearchResponse>(`/search?${params.toString()}`)
  }
}

export const searchService = new SearchService()
