/**
 * @registry-id: dailyOpsMergeProfitByInterval
 * @created: 2026-06-18T00:00:00.000Z
 * @last-modified: 2026-06-18T00:00:00.000Z
 * @description: Merge profit-by-interval DTOs when aggregating daily bundles into week/month/year
 * @last-fix: [2026-06-18] Initial — preserve interval cells so period totals reconcile with headline
 * @adr-ref: ADR-004, ADR-008
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/aggregateDailyBundles.ts
 */

import type { DailyOpsProfitByIntervalDto } from '~/types/daily-ops-dashboard'

export function mergeProfitByIntervalDtos(
  parts: Array<DailyOpsProfitByIntervalDto | null | undefined>,
): DailyOpsProfitByIntervalDto {
  const valid = parts.filter(
    (p): p is DailyOpsProfitByIntervalDto => !!p?.cells && p.cells.length > 0,
  )
  if (valid.length === 0) {
    return {
      estimatesNote: 'Profit-by-interval unavailable for this period — rebuild daily bundles.',
      dates: [],
      cells: [],
    }
  }

  const dateSet = new Set<string>()
  const cells = []
  for (const part of valid) {
    for (const d of part.dates) dateSet.add(d)
    cells.push(...part.cells)
  }

  return {
    estimatesNote: valid[0]!.estimatesNote,
    dates: [...dateSet].sort(),
    cells,
  }
}
