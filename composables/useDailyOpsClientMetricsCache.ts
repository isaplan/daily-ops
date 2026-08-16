/**
 * @registry-id: useDailyOpsClientMetricsCache
 * @created: 2026-08-16T15:55:00.000Z
 * @last-modified: 2026-08-16T15:55:00.000Z
 * @description: Client hold of strip/bundle JSON — freshness by Today / week / older-than-month
 * @last-fix: [2026-08-16] Session client cache + version revalidate (Finance seal aware)
 * @adr-ref: ADR-004, ADR-013, ADR-022
 * @data-source: client-session (server period-cache remains SSOT)
 * @read-cache-json: client useState keyed by period|anchor
 *
 * @exports-to:
 * ✓ composables/useDailyOpsVenueStripMetrics.ts
 * ✓ composables/useDailyOpsDashboardMetrics.ts
 */

import { amsterdamOpenRegisterBusinessDateYmd, addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'

export type ClientMetricsFreshnessTier = 'today' | 'week' | 'recent' | 'archive'

type CacheEntry<T> = {
  data: T
  version: string | null
  financeSealedMonths: number | null
  fetchedAtMs: number
  tier: ClientMetricsFreshnessTier
}

type VersionResponse = {
  version: string | null
  financeSealedMonths: number
}

const STORE_KEY = 'daily-ops-client-metrics-cache-v2'

/** Soft TTL before we bother the version endpoint. */
const TTL_MS: Record<ClientMetricsFreshnessTier, number> = {
  today: 0,
  week: 10 * 60_000,
  recent: 60 * 60_000,
  archive: 24 * 60 * 60_000,
}

export function freshnessTierForRange (
  period: string,
  endDate: string,
  openRegister = amsterdamOpenRegisterBusinessDateYmd(),
): ClientMetricsFreshnessTier {
  if (period === 'today') return 'today'
  if (
    period === 'this-week'
    || period === 'yesterday'
    || period === 'last-week'
    || /^d[2-7]$/.test(period)
  ) {
    return 'week'
  }
  const monthAgo = addCalendarDaysYmd(openRegister, -31)
  if (endDate >= monthAgo) return 'recent'
  return 'archive'
}

function storeMap () {
  return useState<Record<string, CacheEntry<unknown>>>(STORE_KEY, () => ({}))
}

export function clientMetricsCacheKey (
  kind: 'strip' | 'bundle',
  period: string,
  anchor: string | null | undefined,
  location: string | null | undefined,
): string {
  return `${kind}|${period}|${anchor ?? ''}|${location ?? 'all'}`
}

export function readClientMetricsCache<T> (key: string): CacheEntry<T> | null {
  const hit = storeMap().value[key]
  return (hit as CacheEntry<T> | undefined) ?? null
}

export function writeClientMetricsCache<T> (
  key: string,
  data: T,
  meta: {
    version: string | null
    financeSealedMonths?: number | null
    tier: ClientMetricsFreshnessTier
  },
): void {
  storeMap().value = {
    ...storeMap().value,
    [key]: {
      data,
      version: meta.version,
      financeSealedMonths: meta.financeSealedMonths ?? null,
      fetchedAtMs: Date.now(),
      tier: meta.tier,
    },
  }
}

/**
 * true → use cached data (skip network).
 * false → fetch (and optionally compare version first for archive/recent).
 */
export function isClientMetricsCacheFresh (entry: CacheEntry<unknown> | null): boolean {
  if (!entry) return false
  if (entry.tier === 'today') return false
  const ttl = TTL_MS[entry.tier]
  return Date.now() - entry.fetchedAtMs < ttl
}

/** Cheap version check — returns true when server version matches client entry. */
export async function clientMetricsVersionMatches (
  query: Record<string, string>,
  entry: CacheEntry<unknown>,
): Promise<boolean> {
  try {
    const res = await $fetch<VersionResponse>('/api/daily-ops/metrics/period-cache-version', {
      query,
    })
    if (entry.version && res.version && entry.version !== res.version) return false
    if (
      entry.financeSealedMonths != null
      && res.financeSealedMonths !== entry.financeSealedMonths
    ) {
      return false
    }
    if (!entry.version && res.version) return false
    return true
  } catch {
    return false
  }
}

/**
 * Decide whether to skip fetch:
 * - today: never
 * - within soft TTL: yes
 * - past TTL (week/recent/archive): version check; skip if still matches
 */
export async function shouldSkipMetricsFetch (
  entry: CacheEntry<unknown> | null,
  query: Record<string, string>,
): Promise<boolean> {
  if (!entry) return false
  if (entry.tier === 'today') return false
  if (isClientMetricsCacheFresh(entry)) return true
  return clientMetricsVersionMatches(query, entry)
}
