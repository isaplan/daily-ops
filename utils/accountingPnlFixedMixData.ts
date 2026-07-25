/**
 * Fixed children from *Analyse* exports.
 * Overige = legacy fixed; Afschrijving / Financieel annual 2024–2025 only.
 * Parent fixed = sum of children when sealed.
 */

import type { AccountingPnlVenueId, AccountingPnlYear } from '~/utils/accountingPnlData'

export type AccountingPnlFixedSlice = {
  fixedOverige: number
  fixedAfschrijving: number
  fixedFinancieel: number
  fixedOpbrengstVorderingen: number
}

const ANNUAL_FIXED: Partial<Record<AccountingPnlYear, Record<AccountingPnlVenueId, AccountingPnlFixedSlice>>> = {
  2024: {
    vkb: { fixedOverige: 429_239, fixedAfschrijving: 92_697, fixedFinancieel: 9_069, fixedOpbrengstVorderingen: 0 },
    bea: { fixedOverige: 303_131, fixedAfschrijving: 102_296, fixedFinancieel: 25_824, fixedOpbrengstVorderingen: 0 },
    lat: { fixedOverige: 314_156, fixedAfschrijving: 192_095, fixedFinancieel: 40_796, fixedOpbrengstVorderingen: 0 },
  },
  2025: {
    vkb: { fixedOverige: 214_233, fixedAfschrijving: 121_652, fixedFinancieel: 0, fixedOpbrengstVorderingen: 0 },
    bea: { fixedOverige: 319_408, fixedAfschrijving: 94_795, fixedFinancieel: 23_601, fixedOpbrengstVorderingen: 0 },
    lat: { fixedOverige: 274_606, fixedAfschrijving: 96_020, fixedFinancieel: 46_842, fixedOpbrengstVorderingen: 0 },
  },
}

export function accountingPnlFixedForRow (
  year: AccountingPnlYear,
  venueId: AccountingPnlVenueId,
  month: number | null,
  fixedTotal: number,
): AccountingPnlFixedSlice {
  if (month == null) {
    const annual = ANNUAL_FIXED[year]?.[venueId]
    if (annual) return annual
  }
  return {
    fixedOverige: fixedTotal,
    fixedAfschrijving: 0,
    fixedFinancieel: 0,
    fixedOpbrengstVorderingen: 0,
  }
}
