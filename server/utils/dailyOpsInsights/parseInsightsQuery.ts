/**
 * @registry-id: dailyOpsInsightsParseQuery
 * @created: 2026-06-30T20:00:00.000Z
 * @last-modified: 2026-06-30T20:00:00.000Z
 * @description: Parse insights API query (mode, slot, anchor, location)
 * @last-fix: [2026-06-30] Monthly/yearly only — ignores dashboard daily period
 *
 * @exports-to:
 * ✓ server/api/daily-ops/insights.get.ts
 */

import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { coerceInsightsNavMode } from '~/utils/dailyOpsInsightsNav/modes'
import { resolveInsightsRangePair } from '~/utils/dailyOpsInsightsNav/resolveInsightsRange'
import type { InsightsNavMode } from '~/utils/dailyOpsInsightsNav/modes'
import type { InsightsRangePair } from '~/utils/dailyOpsInsightsNav/resolveInsightsRange'

export type InsightsQueryContext = InsightsRangePair & {
  anchor: string
  locationId: string | undefined
  slot: string
}

export function parseInsightsQuery(q: Record<string, unknown>): InsightsQueryContext {
  const mode = coerceInsightsNavMode(typeof q.mode === 'string' ? q.mode : '')
  const anchor =
    typeof q.anchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.anchor)
      ? q.anchor
      : amsterdamOpenRegisterBusinessDateYmd()

  let slot = typeof q.slot === 'string' ? q.slot : ''
  if (!slot) {
    slot = mode === 'yearly' ? 'last-year' : 'last-month'
  }

  const locRaw = typeof q.location === 'string' ? q.location : undefined
  const locationId = locRaw && locRaw !== 'all' ? locRaw : undefined

  const ranges = resolveInsightsRangePair(mode as InsightsNavMode, slot, anchor)

  return {
    ...ranges,
    anchor,
    locationId,
    slot,
  }
}
