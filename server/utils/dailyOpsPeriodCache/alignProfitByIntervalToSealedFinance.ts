/**
 * @registry-id: dailyOpsAlignProfitByIntervalToSealedFinance
 * @created: 2026-08-16T14:50:00.000Z
 * @last-modified: 2026-08-16T15:00:00.000Z
 * @description: Scale CM daypart profits to ADR-022 Est. net (Finance sealed + open CM)
 * @last-fix: [2026-08-16] Sealed months → Finance result; open remainder → period-cache Est. net
 * @adr-ref: ADR-004, ADR-013, ADR-014, ADR-022, PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=month|day (ratios.netProfit)
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsPeriodCache/assembleDashboardBundleFromPeriodCache.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsProfitByIntervalDto } from '~/types/daily-ops-dashboard'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { getMonthKey, monthEndYmd } from '../dailyOpsSnapshot/aggregateDailyBundles'
import { resolvePeriodRange, sumResolvedNodes } from './resolvePeriodRange'
import { findPeriodNode } from './store'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function monthKeysFullyInside (startDate: string, endDate: string): string[] {
  const out: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    const monthKey = getMonthKey(cursor)
    const monthStart = `${monthKey}-01`
    const monthEnd = monthEndYmd(monthKey)
    if (monthStart >= startDate && monthEnd <= endDate) {
      out.push(monthKey)
      cursor = addCalendarDaysYmd(monthEnd, 1)
      continue
    }
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  return out
}

function scaleCellProfits (
  cells: DailyOpsProfitByIntervalDto['cells'],
  idxs: number[],
  target: number,
): void {
  if (idxs.length === 0) return
  let cmSum = 0
  let revSum = 0
  for (const i of idxs) {
    const c = cells[i]!
    cmSum += c.profit
    revSum += c.revenue
  }
  if (Math.abs(cmSum) < 0.005) {
    for (const i of idxs) {
      const c = cells[i]!
      const w = revSum > 0 ? c.revenue / revSum : 1 / idxs.length
      cells[i] = { ...c, profit: round2(target * w) }
    }
    return
  }
  const scale = target / cmSum
  for (const i of idxs) {
    const c = cells[i]!
    cells[i] = { ...c, profit: round2(c.profit * scale) }
  }
}

/**
 * After CM daypart build (ADR-022):
 * 1) Full finance_sealed months → scale dayparts to Finance `result`
 * 2) Open / partial span → scale remaining dayparts so venue total = period-cache Est. net
 */
export async function alignProfitByIntervalToSealedFinance (
  db: Db,
  dto: DailyOpsProfitByIntervalDto,
  opts: { startDate: string; endDate: string },
): Promise<DailyOpsProfitByIntervalDto> {
  if (dto.cells.length === 0) return dto

  const locationIds: Array<string | null> = [
    null,
    ...DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => v.locationId),
  ]

  const monthKeys = monthKeysFullyInside(opts.startDate, opts.endDate)
  const sealedTargets = new Map<string, number>()

  for (const monthKey of monthKeys) {
    for (const locationId of locationIds) {
      const cacheLoc = locationId ?? 'all'
      const node = await findPeriodNode(db, {
        locationId: cacheLoc,
        level: 'month',
        periodKey: monthKey,
      })
      if (!node) continue
      if (node.status !== 'finance_sealed' && node.ratios.source !== 'finance_sealed') continue
      sealedTargets.set(`${cacheLoc}|${monthKey}`, Number(node.ratios.netProfit ?? 0))
    }
  }

  const cells = dto.cells.map((c) => ({ ...c }))

  for (const [key, target] of sealedTargets) {
    const [cacheLoc, monthKey] = key.split('|')
    if (!monthKey) continue
    const locId = cacheLoc === 'all' ? null : (cacheLoc ?? null)
    const idxs: number[] = []
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!
      if ((c.locationId ?? null) !== locId) continue
      if (!c.date.startsWith(monthKey)) continue
      idxs.push(i)
    }
    scaleCellProfits(cells, idxs, target)
  }

  // Pin each venue total to greedy cover Est. net; only touch open/partial cells
  for (const locationId of locationIds) {
    const cacheLoc = locationId ?? 'all'
    const cover = await resolvePeriodRange(db, {
      startDate: opts.startDate,
      endDate: opts.endDate,
      locationId: cacheLoc,
    })
    const periodNet = sumResolvedNodes(cover.nodes).netProfit

    const sealedIdxs: number[] = []
    const openIdxs: number[] = []
    let sealedSum = 0
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!
      if ((c.locationId ?? null) !== locationId) continue
      const mk = c.date.slice(0, 7)
      if (sealedTargets.has(`${cacheLoc}|${mk}`)) {
        sealedIdxs.push(i)
        sealedSum += c.profit
      } else {
        openIdxs.push(i)
      }
    }

    if (openIdxs.length === 0) {
      if (sealedIdxs.length > 0 && Math.abs(sealedSum - periodNet) > 1) {
        scaleCellProfits(cells, sealedIdxs, periodNet)
      }
      continue
    }

    scaleCellProfits(cells, openIdxs, round2(periodNet - sealedSum))
  }

  const note =
    sealedTargets.size > 0
      ? ' Sealed Finance months: daypart profits scaled to P&L result; open span scaled to estimated result (ADR-022).'
      : ' Daypart profits scaled to period-cache estimated result (ADR-022).'

  return {
    ...dto,
    cells,
    estimatesNote: `${dto.estimatesNote}${note}`.trim(),
  }
}
