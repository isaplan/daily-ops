/**
 * Labor children (Lasten personeelsbeloningen) from *Analyse* exports.
 * Annual 2024/2025 + 2026 YTD; months default to all labor in Lonen.
 */

import type { AccountingPnlVenueId, AccountingPnlYear } from '~/utils/accountingPnlData'

export type AccountingPnlLaborSlice = {
  laborLonen: number
  laborSocialeLasten: number
  laborPensioen: number
  laborOverig: number
}

const ANNUAL_LABOR: Partial<Record<AccountingPnlYear, Record<AccountingPnlVenueId, AccountingPnlLaborSlice>>> = {
  2024: {
    vkb: { laborLonen: 822_178, laborSocialeLasten: 99_550, laborPensioen: 26_499, laborOverig: 4_861 },
    bea: { laborLonen: 475_477, laborSocialeLasten: 52_891, laborPensioen: 14_340, laborOverig: 0 },
    lat: { laborLonen: 644_888, laborSocialeLasten: 81_948, laborPensioen: 20_668, laborOverig: 0 },
  },
  2025: {
    vkb: { laborLonen: 772_041, laborSocialeLasten: 95_388, laborPensioen: 26_622, laborOverig: 7_550 },
    bea: { laborLonen: 479_971, laborSocialeLasten: 54_739, laborPensioen: 14_890, laborOverig: 0 },
    lat: { laborLonen: 509_019, laborSocialeLasten: 63_255, laborPensioen: 18_837, laborOverig: 0 },
  },
  2026: {
    vkb: { laborLonen: 280_114, laborSocialeLasten: 31_494, laborPensioen: 8_908, laborOverig: 2_950 },
    bea: { laborLonen: 182_569, laborSocialeLasten: 17_492, laborPensioen: 4_466, laborOverig: 0 },
    lat: { laborLonen: 216_289, laborSocialeLasten: 25_622, laborPensioen: 6_736, laborOverig: 0 },
  },
}

export function accountingPnlLaborForRow (
  year: AccountingPnlYear,
  venueId: AccountingPnlVenueId,
  month: number | null,
  laborTotal: number,
): AccountingPnlLaborSlice {
  if (month == null) {
    const annual = ANNUAL_LABOR[year]?.[venueId]
    if (annual) return annual
  }
  return {
    laborLonen: laborTotal,
    laborSocialeLasten: 0,
    laborPensioen: 0,
    laborOverig: 0,
  }
}
