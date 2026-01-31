/**
 * @registry-id: borkV2ApiClient
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Bork API client with date-range batching and rate limiting
 * @last-fix: [2026-01-30] Batching: day delay, batch chunk size, batch delay
 *
 * @imports-from:
 *   - app/lib/bork/v2-types.ts => BORK_DAY_REQUEST_DELAY_MS, BORK_BATCH_DAYS, BORK_BATCH_DELAY_MS, BORK_DATE_RANGE_MAX_DAYS
 *
 * @exports-to:
 *   ✓ app/api/bork/v2/sync/route.ts, app/lib/services/salesSyncService.ts => fetchBorkDataForDateRange
 */

import {
  BORK_DAY_REQUEST_DELAY_MS,
  BORK_BATCH_DAYS,
  BORK_BATCH_DELAY_MS,
  BORK_DATE_RANGE_MAX_DAYS,
} from './v2-types';

/**
 * Fetch Bork API data for a single date (one request).
 *
 * @param baseUrl - Base URL (e.g. https://xxx.trivecgateway.com)
 * @param apiKey - API key (appid)
 * @param date - YYYYMMDD
 * @returns Array of ticket data
 */
export async function fetchBorkDataForDate(
  baseUrl: string,
  apiKey: string,
  date: string
): Promise<unknown[]> {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const url = `${cleanBaseUrl}/ticket/day.json/${date}?appid=${apiKey}&IncOpen=True&IncInternal=True`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Bork API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const arr = (data as Record<string, unknown>).data ?? (data as Record<string, unknown>).tickets ?? (data as Record<string, unknown>).items ?? (data as Record<string, unknown>).results;
    if (Array.isArray(arr)) return arr;
  }
  return [];
}

/**
 * Sleep helper for batching delays.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Per-day result so tickets without ActualDate can use request date (no data skipped). */
export type BorkDayResult = { dateKey: string; tickets: unknown[] };

/**
 * Fetch Bork API data for a date range with per-day structure.
 * - One API call per day; returns { dateKey (YYYY-MM-DD), tickets } per day
 * - When ActualDate is missing on a ticket, sync uses dateKey so no tickets are skipped
 * - BORK_DAY_REQUEST_DELAY_MS between each day request
 * - Rejects if range > BORK_DATE_RANGE_MAX_DAYS
 *
 * @param baseUrl - Base URL
 * @param apiKey - API key
 * @param startDate - YYYY-MM-DD
 * @param endDate - YYYY-MM-DD
 * @returns Array of { dateKey, tickets } per day (request date = fallback for missing ActualDate)
 */
export async function fetchBorkDataForDateRange(
  baseUrl: string,
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<BorkDayResult[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (daysDiff > BORK_DATE_RANGE_MAX_DAYS) {
    throw new Error(
      `Date range too large: ${daysDiff} days. Maximum ${BORK_DATE_RANGE_MAX_DAYS} days allowed.`
    );
  }

  const results: BorkDayResult[] = [];
  let current = new Date(start);
  let dayIndex = 0;

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const dateKey = `${year}-${month}-${day}`;

    try {
      const dayData = await fetchBorkDataForDate(baseUrl, apiKey, dateStr);
      if (Array.isArray(dayData)) {
        results.push({ dateKey, tickets: dayData });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Bork API] Error fetching ${dateStr}:`, msg);
    }

    dayIndex++;
    current.setDate(current.getDate() + 1);

    if (current <= end) await delay(BORK_DAY_REQUEST_DELAY_MS);
    if (dayIndex > 0 && dayIndex % BORK_BATCH_DAYS === 0 && current <= end) await delay(BORK_BATCH_DELAY_MS);
  }

  return results;
}
