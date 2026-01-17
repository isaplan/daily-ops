/**
 * @registry-id: searchTypes
 * @created: 2026-01-16T22:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Type definitions for search functionality
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/searchService.ts => Uses search types
 *   ✓ app/lib/viewmodels/useSearchViewModel.ts => Uses search types
 */

export type SearchEntityType = 'note' | 'todo' | 'decision' | 'event'

export interface SearchResult {
  type: SearchEntityType
  id: string
  title: string
  content?: string
  description?: string
  slug?: string
  status?: string
}

export interface SearchFilters {
  q: string
  types?: SearchEntityType[]
  skip?: number
  limit?: number
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  skip: number
  limit: number
}
