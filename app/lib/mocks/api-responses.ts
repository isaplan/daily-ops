/**
 * @registry-id: apiResponseMocks
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Mock API responses for testing services and ViewModels
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/__tests__/** => Service tests use mock responses
 *   ✓ app/lib/viewmodels/__tests__/** => ViewModel tests use mock responses
 */

import { createMockChannel, createMockMember, createMockTeam, createMockLocation, createMockEvent, createMockNote } from '../test-helpers'

export const mockApiResponses = {
  channels: {
    getAll: {
      success: true,
      data: [createMockChannel(), createMockChannel({ _id: 'channel-2', name: 'Channel 2' })],
    },
    getById: {
      success: true,
      data: createMockChannel(),
    },
    create: {
      success: true,
      data: createMockChannel({ name: 'New Channel' }),
    },
    update: {
      success: true,
      data: createMockChannel({ name: 'Updated Channel' }),
    },
    delete: {
      success: true,
      data: undefined,
    },
  },
  members: {
    getAll: {
      success: true,
      data: [createMockMember(), createMockMember({ _id: 'member-2', name: 'Member 2' })],
    },
    getById: {
      success: true,
      data: createMockMember(),
    },
  },
  teams: {
    getAll: {
      success: true,
      data: [createMockTeam(), createMockTeam({ _id: 'team-2', name: 'Team 2' })],
    },
  },
  locations: {
    getAll: {
      success: true,
      data: [createMockLocation(), createMockLocation({ _id: 'location-2', name: 'Location 2' })],
    },
  },
  events: {
    getAll: {
      success: true,
      data: [createMockEvent(), createMockEvent({ _id: 'event-2', name: 'Event 2' })],
    },
  },
  notes: {
    getAll: {
      success: true,
      data: [createMockNote(), createMockNote({ _id: 'note-2', title: 'Note 2' })],
    },
  },
}
