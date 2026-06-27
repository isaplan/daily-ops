/**
 * @registry-id: revenueNavV2ToRevenueApiQuery
 * @created: 2026-06-24T00:00:00.000Z
 * @last-modified: 2026-06-24T00:00:00.000Z
 * @description: Map Nav V2 slot + resolved range → revenue API query params (ADR-011)
 * @last-fix: [2026-06-24] Wire V2 nav slot to /api/daily-ops/revenue/* period/range
 * @adr-ref: ADR-011
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueAnalyticsPeriod.ts
 */

import {
  REVENUE_ANALYTICS_PERIOD_IDS,
  type DailyOpsRevenuePeriodId,
  type DailyOpsRevenueRange,
} from '~/types/daily-ops-revenue'
import type { RevenueNavV2Granularity, RevenueNavV2Range, RevenueNavV2Slot } from '~/types/daily-ops-revenue-nav-v2'
import { resolveRevenueNavV2Range } from '~/utils/dailyOpsRevenueNavV2/resolveRange'

const ANALYTICS_SET = new Set<string>(REVENUE_ANALYTICS_PERIOD_IDS)

/** V2 slots that map 1:1 to existing revenue `period` query ids. */
const SLOT_TO_PERIOD: Partial<Record<RevenueNavV2Slot, DailyOpsRevenuePeriodId>> = {
  'this-week': 'this-week',
  'last-week': 'last-week',
  'this-month': 'this-month',
  'last-month': 'last-month',
  q1: 'q1',
  q2: 'q2',
  q3: 'q3',
  q4: 'q4',
  'last-q': 'last-q',
  'this-year': 'this-year',
  'last-year': 'last-year',
  'year-2': 'year-2',
  'last-7d': 'last-7d',
  'last-14d': 'last-14d',
}

export type RevenueNavV2ApiQuery = {
  period: DailyOpsRevenuePeriodId
  startDate: string
  endDate: string
  label: string
  granularity: RevenueNavV2Granularity
}

export function periodIdForNavV2Slot(slot: RevenueNavV2Slot): DailyOpsRevenuePeriodId {
  const mapped = SLOT_TO_PERIOD[slot]
  if (mapped && ANALYTICS_SET.has(mapped)) return mapped
  return 'custom'
}

export function resolveNavV2RevenueApiQuery(opts: {
  slot: RevenueNavV2Slot
  pick?: string | null
  granularity?: RevenueNavV2Granularity | null
  now?: Date
}): RevenueNavV2ApiQuery | null {
  const range = resolveRevenueNavV2Range(opts.slot, {
    pick: opts.pick,
    granularity: opts.granularity,
    now: opts.now,
  })
  if (!range) return null
  const period = periodIdForNavV2Slot(opts.slot)
  return {
    period,
    startDate: range.startDate,
    endDate: range.endDate,
    label: range.label,
    granularity: range.bucket,
  }
}

export function navV2RangeToRevenueRange(
  api: RevenueNavV2ApiQuery,
): DailyOpsRevenueRange {
  return {
    period: api.period,
    startDate: api.startDate,
    endDate: api.endDate,
    label: api.label,
  }
}

export function buildRevenueQueryFromNavV2(
  api: RevenueNavV2ApiQuery,
  extras: {
    anchor: string
    locationId?: string | null
    locationSpace?: string | null
    compareTo?: string
    comparePeriod?: string
    compareLocation?: string | null
    compareStartDate?: string
    compareEndDate?: string
  },
): Record<string, string> {
  const q: Record<string, string> = {
    period: api.period,
    compareTo: extras.compareTo ?? 'none',
    anchor: extras.anchor,
  }
  if (extras.locationId) q.location = extras.locationId
  if (extras.locationSpace) q.space = extras.locationSpace
  if (api.period === 'custom') {
    q.startDate = api.startDate
    q.endDate = api.endDate
  }
  if (api.granularity !== 'day') q.granularity = api.granularity
  if (extras.compareTo === 'ab' && extras.comparePeriod) {
    q.comparePeriod = extras.comparePeriod
    if (extras.compareLocation) q.compareLocation = extras.compareLocation
    if (extras.compareStartDate) q.compareStartDate = extras.compareStartDate
    if (extras.compareEndDate) q.compareEndDate = extras.compareEndDate
  }
  return q
}
