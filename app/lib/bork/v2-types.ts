/**
 * @registry-id: borkV2Types
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Bork API types and batching constants for rate limits and date ranges
 * @last-fix: [2026-01-30] Initial Bork integration with batching
 *
 * @exports-to:
 *   ✓ app/lib/bork/v2-api-client.ts => batching + date range validation
 *   ✓ app/lib/bork/v2-credentials.ts => credential typing
 */

export interface BorkApiCredentials {
  baseUrl: string;
  apiKey: string;
}

/** Delay in ms between each day API request (rate limiting) */
export const BORK_DAY_REQUEST_DELAY_MS = 100;

/** Max days per date range (reject or chunk if larger) */
export const BORK_DATE_RANGE_MAX_DAYS = 365;

/** Days per "batch" when chunking; delay applied between batches */
export const BORK_BATCH_DAYS = 31;

/** Delay in ms between batches (after each BORK_BATCH_DAYS chunk) */
export const BORK_BATCH_DELAY_MS = 200;
