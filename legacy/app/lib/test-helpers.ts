/**
 * @registry-id: testHelpers
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Test helper functions - mock factories, test data generators
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ **/__tests__/** => All tests use mock factories and helpers
 */

/**
 * Create a mock API response
 */
export function createMockApiResponse<T>(data: T, success = true) {
  return {
    success,
    data: success ? data : undefined,
    error: success ? undefined : 'Mock error',
  }
}

/**
 * Create a mock channel
 */
export function createMockChannel(overrides?: Partial<any>) {
  return {
    _id: 'mock-channel-id',
    name: 'Mock Channel',
    description: 'Mock description',
    type: 'general',
    members: [],
    created_by: { _id: 'mock-user-id', name: 'Mock User' },
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock member
 */
export function createMockMember(overrides?: Partial<any>) {
  return {
    _id: 'mock-member-id',
    name: 'Mock Member',
    email: 'mock@example.com',
    is_active: true,
    ...overrides,
  }
}

/**
 * Create a mock team
 */
export function createMockTeam(overrides?: Partial<any>) {
  return {
    _id: 'mock-team-id',
    name: 'Mock Team',
    description: 'Mock team description',
    is_active: true,
    ...overrides,
  }
}

/**
 * Create a mock location
 */
export function createMockLocation(overrides?: Partial<any>) {
  return {
    _id: 'mock-location-id',
    name: 'Mock Location',
    ...overrides,
  }
}

/**
 * Create a mock event
 */
export function createMockEvent(overrides?: Partial<any>) {
  return {
    _id: 'mock-event-id',
    name: 'Mock Event',
    client_name: 'Mock Client',
    guest_count: 50,
    date: new Date().toISOString(),
    status: 'planning' as const,
    ...overrides,
  }
}

/**
 * Create a mock note
 */
export function createMockNote(overrides?: Partial<any>) {
  return {
    _id: 'mock-note-id',
    title: 'Mock Note',
    content: 'Mock note content',
    slug: 'mock-note',
    is_pinned: false,
    is_archived: false,
    status: 'published' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Wait for async operations to complete
 */
export function waitForAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
