/**
 * @registry-id: buildBreakEvenAssumptions
 * @created: 2026-07-24T11:30:00.000Z
 * @last-modified: 2026-08-04T17:55:00.000Z
 * @description: Build break-even assumptions value from sealed monthly P&L docs
 * @last-fix: [2026-08-04] Empty slice includes FT-fixed / PT-ZZP-flex fields (ADR-019)
 * @adr-ref: ADR-014, ADR-019
 *
 * @exports-to:
 * ✓ server/utils/accountingPnl/refreshFinanceAssumptions.ts
 */

import type { AccountingPnlRow } from '~/utils/accountingPnlData'
import type {
  BreakEvenAssumptionsValue,
  BreakEvenVenueKey,
  BreakEvenVenueSlice,
} from '~/types/break-even'
import {
  breakEvenSliceFromRow,
  monthKey,
  sumPnlRowsForBreakEven,
} from '~/utils/accountingPnlBreakEvenMath'
import type { SealedMonthlyPnlDoc } from './fetchSealedMonthlyPnlRows'

const VENUE_KEYS: BreakEvenVenueKey[] = ['vkb', 'bea', 'lat', 'combined']
const ROLLING_WINDOW = 12 as const

function emptySlice (venueId: BreakEvenVenueKey): BreakEvenVenueSlice {
  return {
    venueId,
    monthlyBreakEven: 0,
    monthlyRevenue: 0,
    monthlyLabor: 0,
    monthlyFixedLabor: 0,
    monthlyFlexLabor: 0,
    monthlyCogs: 0,
    monthlyFixed: 0,
    cogsPct: 0,
    laborPct: 0,
    fixedLaborPct: 0,
    flexLaborPct: 0,
    source: 'default',
    year: null,
    month: null,
    monthsInWindow: 0,
  }
}

function rowForVenue (doc: SealedMonthlyPnlDoc, key: BreakEvenVenueKey): AccountingPnlRow {
  return key === 'combined' ? doc.combined : doc.venues[key]
}

export function buildBreakEvenAssumptionsFromMonths (
  months: SealedMonthlyPnlDoc[],
): BreakEvenAssumptionsValue {
  const window = months.slice(0, ROLLING_WINDOW)
  const rolling = {} as Record<BreakEvenVenueKey, BreakEvenVenueSlice>
  for (const key of VENUE_KEYS) {
    const rows = window.map((m) => rowForVenue(m, key)).filter((r) => r.revenue > 0)
    const avg = sumPnlRowsForBreakEven(rows)
    const slice = avg
      ? breakEvenSliceFromRow(key, avg, 'rolling_12m', {
          monthsInWindow: rows.length,
          year: window[0]?.year ?? null,
          month: window[0]?.month ?? null,
        })
      : null
    rolling[key] = slice ?? emptySlice(key)
  }

  const actualByMonth: BreakEvenAssumptionsValue['actualByMonth'] = {}
  for (const doc of months) {
    const key = monthKey(doc.year, doc.month)
    const venueMap = {} as Record<BreakEvenVenueKey, BreakEvenVenueSlice>
    for (const v of VENUE_KEYS) {
      const slice = breakEvenSliceFromRow(v, rowForVenue(doc, v), 'actual_month', {
        year: doc.year,
        month: doc.month,
        monthsInWindow: 1,
      })
      venueMap[v] = slice ?? emptySlice(v)
    }
    actualByMonth[key] = venueMap
  }

  return {
    schemaVersion: 1,
    rollingWindowMonths: ROLLING_WINDOW,
    computedAt: new Date().toISOString(),
    rolling,
    actualByMonth,
  }
}
