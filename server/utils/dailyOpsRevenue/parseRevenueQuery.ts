/**
 * @registry-id: dailyOpsRevenueParseQuery
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Parses revenue API query params into RevenueQueryContext
 * @last-fix: [2026-05-20] Initial
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/*
 */

import {
  resolveDailyOpsRevenuePeriod,
  resolveRevenueCompareRange,
} from '~/utils/dailyOpsRevenuePeriod'
import type {
  DailyOpsRevenueCompareKind,
  DailyOpsRevenueQueryContext,
} from '~/types/daily-ops-revenue'

const COMPARE_SET = new Set<string>(['none', 'previous', 'ly', 'custom', 'ab'])

export function parseRevenueQuery(q: Record<string, unknown>): DailyOpsRevenueQueryContext {
  const periodRaw = typeof q.period === 'string' ? q.period : 'today'
  const anchor = typeof q.anchor === 'string' ? q.anchor : undefined
  const customStart = typeof q.startDate === 'string' ? q.startDate : undefined
  const customEnd = typeof q.endDate === 'string' ? q.endDate : undefined
  const range = resolveDailyOpsRevenuePeriod(periodRaw, anchor, new Date(), {
    startDate: customStart,
    endDate: customEnd,
  })

  let compareRaw = typeof q.compareTo === 'string' ? q.compareTo : 'none'
  const comparePeriodRaw = typeof q.comparePeriod === 'string' ? q.comparePeriod : undefined
  if (compareRaw === 'none' && comparePeriodRaw) compareRaw = 'ab'

  const compareKind = (COMPARE_SET.has(compareRaw) ? compareRaw : 'none') as DailyOpsRevenueCompareKind
  const compareStart = typeof q.compareStartDate === 'string' ? q.compareStartDate : undefined
  const compareEnd = typeof q.compareEndDate === 'string' ? q.compareEndDate : undefined

  let compareRange =
    compareKind === 'ab' && comparePeriodRaw
      ? resolveDailyOpsRevenuePeriod(comparePeriodRaw, anchor, new Date())
      : resolveRevenueCompareRange(compareKind, range, new Date(), {
          startDate: compareStart,
          endDate: compareEnd,
        })

  if (compareKind === 'ab' && compareRange) {
    compareRange = { ...compareRange, label: `Vergelijk: ${compareRange.label}` }
  }

  const locRaw = typeof q.location === 'string' ? q.location : undefined
  const locationId = locRaw && locRaw !== 'all' ? locRaw : undefined
  const locationSpace = typeof q.space === 'string' ? q.space : undefined
  const compareLocRaw = typeof q.compareLocation === 'string' ? q.compareLocation : undefined
  const compareLocationId =
    compareLocRaw && compareLocRaw !== 'all' ? compareLocRaw : undefined

  return {
    period: range.period,
    startDate: range.startDate,
    endDate: range.endDate,
    label: range.label,
    locationId,
    locationSpace,
    compareKind,
    compareStartDate: compareRange?.startDate,
    compareEndDate: compareRange?.endDate,
    compareLabel: compareRange?.label,
    compareLocationId,
  }
}
