/**
 * @registry-id: eitjeV2Types
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Type definitions and constants for the Eitje V2 API integration
 * @last-fix: [2026-01-24] Added metadata header for validation
 *
 * @exports-to:
 *   ✓ app/lib/eitje/v2-api-client.ts => credentials + limits for requests
 *   ✓ app/lib/eitje/v2-credentials.ts => credential typing
 *   ✓ app/lib/cron/v2-cron-manager.ts => date chunking limits per endpoint
 */

export interface EitjeCredentials {
  partner_username: string;
  partner_password: string;
  api_username: string;
  api_password: string;
}

export interface EitjeApiConfig {
  baseUrl: string;
  credentials: EitjeCredentials;
}

export const EITJE_ENDPOINTS = {
  environments: '/environments',
  teams: '/teams',
  users: '/users',
  shift_types: '/shift_types',
  time_registration_shifts: '/time_registration_shifts',
  planning_shifts: '/planning_shifts',
  revenue_days: '/revenue_days',
  availability_shifts: '/availability_shifts',
  leave_requests: '/leave_requests',
  events: '/events'
} as const;

export const EITJE_DATE_LIMITS = {
  time_registration_shifts: 7,
  planning_shifts: 7,
  revenue_days: 90,
  availability_shifts: 7,
  leave_requests: 7,
  events: 90
} as const;

// Simple response type for API calls
export interface EitjeApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  responseTime: number;
}
