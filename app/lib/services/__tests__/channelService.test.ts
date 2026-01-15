/**
 * @registry-id: channelServiceTest
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Tests for channelService
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/channelService.ts => channelService
 *   - app/lib/mocks/api-responses.ts => Mock API responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { channelService } from '../channelService'
import { mockApiResponses } from '@/lib/mocks/api-responses'

// Mock fetch globally
global.fetch = vi.fn()

describe('channelService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should get all channels', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponses.channels.getAll,
    })

    const result = await channelService.getAll()

    expect(fetch).toHaveBeenCalledWith('/api/channels', expect.any(Object))
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  })

  it('should get channel by id', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponses.channels.getById,
    })

    const result = await channelService.getById('test-id')

    expect(fetch).toHaveBeenCalledWith('/api/channels/test-id', expect.any(Object))
    expect(result.success).toBe(true)
  })

  it('should create channel', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponses.channels.create,
    })

    const result = await channelService.create({
      name: 'New Channel',
      type: 'general',
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/channels',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('New Channel'),
      })
    )
    expect(result.success).toBe(true)
  })

  it('should update channel', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponses.channels.update,
    })

    const result = await channelService.update('test-id', {
      name: 'Updated Channel',
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/channels/test-id',
      expect.objectContaining({
        method: 'PUT',
      })
    )
    expect(result.success).toBe(true)
  })

  it('should delete channel', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponses.channels.delete,
    })

    const result = await channelService.delete('test-id')

    expect(fetch).toHaveBeenCalledWith(
      '/api/channels/test-id',
      expect.objectContaining({
        method: 'DELETE',
      })
    )
    expect(result.success).toBe(true)
  })
})
