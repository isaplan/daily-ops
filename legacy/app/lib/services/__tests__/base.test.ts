/**
 * @registry-id: apiServiceBaseTest
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Tests for ApiService base class
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiService, ApiServiceError } from '../base'

// Mock fetch globally
global.fetch = vi.fn()

describe('ApiService', () => {
  let service: ApiService

  beforeEach(() => {
    service = new ApiService('/api')
    vi.clearAllMocks()
  })

  describe('get', () => {
    it('should make GET request and return data', async () => {
      const mockData = { data: [{ id: '1', name: 'Test' }] }
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result = await service['get']('/test')

      expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }))
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData.data)
    })

    it('should throw ApiServiceError on error response', async () => {
      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found', code: 'NOT_FOUND' }),
      })

      await expect(service['get']('/test')).rejects.toThrow(ApiServiceError)
    })
  })

  describe('post', () => {
    it('should make POST request with body', async () => {
      const mockData = { data: { id: '1', name: 'Created' } }
      const body = { name: 'Test' }
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result = await service['post']('/test', body)

      expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }))
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData.data)
    })
  })

  describe('put', () => {
    it('should make PUT request with body', async () => {
      const mockData = { data: { id: '1', name: 'Updated' } }
      const body = { name: 'Updated' }
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result = await service['put']('/test/1', body)

      expect(fetch).toHaveBeenCalledWith('/api/test/1', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(body),
      }))
      expect(result.success).toBe(true)
    })
  })

  describe('delete', () => {
    it('should make DELETE request', async () => {
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const result = await service['delete']('/test/1')

      expect(fetch).toHaveBeenCalledWith('/api/test/1', expect.objectContaining({
        method: 'DELETE',
      }))
      expect(result.success).toBe(true)
    })
  })
})
