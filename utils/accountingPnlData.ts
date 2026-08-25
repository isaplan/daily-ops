/**
 * Accounting P&L benchmarks — sourced from *Analyse* exports (2024/2025 full year, 2026 Jan–Jul monthly + YTD).
 * Fixed parent = overige + afschrijving + financieel when children present; legacy docs = overige only.
 * Grandchildren: Analyse GL lines under Food/Bev revenue & COGS and under Labor Lonen.
 */

import { accountingPnlRowWithMix } from '~/utils/accountingPnlMixData'
import {
  emptyCogsBevLines,
  emptyCogsFoodLines,
  emptyLaborLonenLines,
  emptyRevenueBevLines,
  emptyRevenueFoodLines,
  type AccountingPnlCogsBevLines,
  type AccountingPnlCogsFoodLines,
  type AccountingPnlLaborLonenLines,
  type AccountingPnlRevenueBevLines,
  type AccountingPnlRevenueFoodLines,
} from '~/utils/accountingPnlGrandchildLines'
import { sumAccountingPnlRows } from '~/utils/accountingPnlRowMath'

export type AccountingPnlVenueId = 'vkb' | 'bea' | 'lat'

export type AccountingPnlRow = {
  revenue: number
  revenueFood: number
  revenueBeverage: number
  revenueFoodLines: AccountingPnlRevenueFoodLines
  revenueBevLines: AccountingPnlRevenueBevLines
  labor: number
  laborLonen: number
  laborLonenLines: AccountingPnlLaborLonenLines
  laborSocialeLasten: number
  laborPensioen: number
  laborOverig: number
  cogs: number
  cogsFood: number
  cogsBeverage: number
  cogsFoodLines: AccountingPnlCogsFoodLines
  cogsBevLines: AccountingPnlCogsBevLines
  fixed: number
  fixedOverige: number
  fixedAfschrijving: number
  fixedFinancieel: number
  /** Analyse income line (positive cash in); stored signed negative so fixed = sum(children). */
  fixedOpbrengstVorderingen: number
  result: number
}

export type AccountingPnlVenueMeta = {
  id: AccountingPnlVenueId
  label: string
  shortLabel: string
}

export const ACCOUNTING_PNL_VENUES: AccountingPnlVenueMeta[] = [
  { id: 'vkb', label: 'Van Kinsbergen', shortLabel: 'VKB' },
  { id: 'bea', label: 'Bar Bea', shortLabel: 'BEA' },
  { id: 'lat', label: "l'Amour Toujours", shortLabel: 'LAT' },
]

/** Maps Daily Ops Mongo locationId → accounting P&L venue id (order matches DAILY_OPS_PROFIT_VENUE_LOCATIONS). */
export const ACCOUNTING_PNL_LOCATION_ID_TO_VENUE: Record<string, AccountingPnlVenueId> = {
  '69d6cfa63d2adf93b79d1ae7': 'vkb',
  '69d6cfa63d2adf93b79d1ae6': 'bea',
  '69d6cfa73d2adf93b79d1ae8': 'lat',
}

export function accountingPnlVenueIdForLocationId(locationId: string): AccountingPnlVenueId | null {
  return ACCOUNTING_PNL_LOCATION_ID_TO_VENUE[locationId] ?? null
}

export const ACCOUNTING_PNL_YEARS = [2024, 2025, 2026] as const
export type AccountingPnlYear = (typeof ACCOUNTING_PNL_YEARS)[number]

export const ACCOUNTING_PNL_MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export const ACCOUNTING_PNL_MONTH_LONG_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** [revenue, cogs, labor, fixed, result] — costs stored as positive magnitudes. */
type PnlTuple = [number, number, number, number, number]

function rowBase ([revenue, cogs, labor, fixed, result]: PnlTuple): AccountingPnlRow {
  return {
    revenue,
    revenueFood: 0,
    revenueBeverage: 0,
    revenueFoodLines: emptyRevenueFoodLines(),
    revenueBevLines: emptyRevenueBevLines(),
    cogs,
    cogsFood: 0,
    cogsBeverage: cogs,
    cogsFoodLines: emptyCogsFoodLines(),
    cogsBevLines: emptyCogsBevLines(),
    labor,
    laborLonen: labor,
    laborLonenLines: emptyLaborLonenLines(),
    laborSocialeLasten: 0,
    laborPensioen: 0,
    laborOverig: 0,
    fixed,
    fixedOverige: fixed,
    fixedAfschrijving: 0,
    fixedFinancieel: 0,
    fixedOpbrengstVorderingen: 0,
    result,
  }
}

function row ([revenue, cogs, labor, fixed, result]: PnlTuple): AccountingPnlRow {
  return rowBase([revenue, cogs, labor, fixed, result])
}

function sumRows (rows: AccountingPnlRow[]): AccountingPnlRow {
  return sumAccountingPnlRows(rows)
}

function annualRow (partial: {
  revenue: number
  labor: number
  cogs: number
  fixed: number
  result: number
}): AccountingPnlRow {
  return rowBase([partial.revenue, partial.cogs, partial.labor, partial.fixed, partial.result])
}

const MONTHLY_2024: Record<AccountingPnlVenueId, PnlTuple[]> = {
  vkb: [
    [160849, 50522, 70520, 28350, 5555],
    [161893, 54694, 75876, 31911, -6473],
    [204626, 70810, 77258, 40562, 9998],
    [191324, 56600, 74659, 32357, 21571],
    [203608, 64474, 81300, 28088, 23287],
    [206429, 68111, 73395, 38947, 19203],
    [229985, 69903, 84358, 35588, 33228],
    [204518, 64960, 79429, 32280, 20825],
    [153622, 48015, 77395, 26269, -5643],
    [155381, 55797, 86487, 41972, -38167],
    [179895, 52900, 97842, 42125, -22343],
    [232050, 20581, 74569, 50790, 73242],
  ],
  bea: [
    [96203, 35534, 39290, 20812, -9260],
    [101481, 35338, 37948, 24745, -5383],
    [146796, 47147, 42423, 24228, 23091],
    [147703, 49377, 47616, 25976, 14799],
    [152746, 49838, 52709, 22989, 17264],
    [143950, 48752, 50003, 26860, 8363],
    [137439, 41826, 44738, 24242, 16449],
    [153441, 47875, 45809, 27187, 22367],
    [115213, 36575, 44459, 26140, -2144],
    [115277, 37174, 41225, 24227, 2489],
    [123018, 40182, 43229, 28358, 1105],
    [96212, 42717, 53259, 27367, 39479],
  ],
  lat: [
    [101135, 37473, 51215, 29738, -30725],
    [166515, 59783, 60146, 21905, 9643],
    [160696, 73110, 61975, 23285, -13492],
    [160189, 53572, 67616, 28434, -10044],
    [175118, 68301, 67988, 25387, -7267],
    [175166, 58348, 67970, 19392, 8451],
    [162666, 47783, 62271, 23596, 7995],
    [164947, 59646, 64797, 22181, -2702],
    [137585, 50523, 61095, 28710, -23792],
    [140117, 49740, 59451, 27612, -17740],
    [135611, 42493, 51619, 28245, -7800],
    [142695, 18782, 71361, 35671, -4192],
  ],
}

const MONTHLY_2025: Record<AccountingPnlVenueId, PnlTuple[]> = {
  vkb: [
    [141481, 46249, 81793, 30856, -26824],
    [127765, 44913, 55430, 34564, -16605],
    [172610, 72486, 71865, 59209, -40529],
    [183713, 57129, 68715, 32160, 16004],
    [185092, 62698, 84195, 33948, -5515],
    [173132, 60723, 87380, 32479, -17247],
    [188347, 61485, 78044, 31831, 7181],
    [171269, 56151, 81175, 28151, -4014],
    [138042, 45568, 70770, 32759, -20877],
    [154841, 49317, 74541, 45098, -23205],
    [154010, 54793, 74384, 32645, -16933],
    [186470, 6903, 73309, 179467, 275485],
  ],
  bea: [
    [94032, 29406, 41912, 20715, -8374],
    [108871, 30388, 38850, 25843, 3457],
    [149320, 50724, 49056, 31646, 7711],
    [143664, 45246, 50892, 29029, 8171],
    [167269, 45858, 53345, 25397, 32323],
    [123572, 38544, 59965, 28376, -13682],
    [139786, 38604, 42382, 26746, 21664],
    [129726, 42410, 45798, 22823, 8290],
    [110704, 34573, 43758, 27790, -5871],
    [114594, 23569, 44543, 32832, 3173],
    [112672, 38525, 40473, 28138, -5266],
    [107272, 72770, 38626, 20073, 117405],
  ],
  lat: [
    [107619, 32826, 41177, 22586, 44],
    [91198, 26136, 50960, 21794, -18525],
    [126684, 41928, 50706, 25549, -2405],
    [134220, 53853, 52569, 24584, -7687],
    [141579, 52708, 57655, 22754, -2434],
    [113030, 45340, 52895, 23760, -19856],
    [113521, 33545, 66894, 23137, -21240],
    [93057, 32245, 54336, 15344, -21524],
    [84493, 30683, 45009, 27315, -31504],
    [100995, 30004, 44692, 23699, -10899],
    [94705, 31728, 35493, 27110, -12938],
    [138859, 1337, 38725, 16974, 70690],
  ],
}

/** Jan–Jul 2026 monthly — [revenue, cogs, labor, fixed, result]. Jul BEA/LAT placeholders until Analyse fill. */
const MONTHLY_2026: Record<AccountingPnlVenueId, PnlTuple[]> = {
  vkb: [
    [113144, 44847, 65533, 41901, -39137],
    [125194, 40106, 63331, 45179, -23422],
    [158598, 52474, 66479, 48853, -9208],
    [173806, 58310, 57691, 46315, 11490],
    [159724, 52648, 70951, 46753, -10628],
    [161342, 57166, 72935, 48179, -16938],
    [174780, 53969, 58528, 41351, 20932],
  ],
  bea: [
    [92241, 30687, 36091, 36902, -11439],
    [93858, 37131, 36016, 38647, -17936],
    [130057, 43913, 36284, 44250, 5610],
    [166792, 54832, 43523, 41801, 26636],
    [144408, 44949, 49093, 49416, 950],
    [122032, 43463, 49888, 40966, -12285],
    [0, 0, 0, 0, 0],
  ],
  lat: [
    [85081, 28120, 45116, 48402, -36557],
    [74572, 34566, 51460, 44255, -55709],
    [83430, 30479, 45479, 51645, -44173],
    [94860, 29698, 54714, 46220, -35772],
    [80295, 36098, 51833, 45364, -53000],
    [61667, 23743, 36889, 37576, -36541],
    [0, 0, 0, 0, 0],
  ],
}

/** Jan–May 2026 YTD totals (accounting export). */
const YTD_2026: Record<AccountingPnlVenueId, AccountingPnlRow> = {
  vkb: annualRow({ revenue: 730466, labor: 323466, cogs: 250006, fixed: 227700, result: -70706 }),
  bea: annualRow({ revenue: 627356, labor: 204527, cogs: 209225, fixed: 209234, result: 4370 }),
  lat: annualRow({ revenue: 418238, labor: 248647, cogs: 151565, fixed: 235269, result: -217243 }),
}

const ANNUAL_2024: Record<AccountingPnlVenueId, AccountingPnlRow> = {
  vkb: annualRow({ revenue: 2284180, labor: 953088, cogs: 677367, fixed: 429239, result: 134283 }),
  bea: annualRow({ revenue: 1529479, labor: 542708, cogs: 426901, fixed: 303131, result: 128619 }),
  lat: annualRow({ revenue: 1822440, labor: 747504, cogs: 619554, fixed: 314156, result: -91665 }),
}

const ANNUAL_2025: Record<AccountingPnlVenueId, AccountingPnlRow> = {
  vkb: annualRow({ revenue: 1976772, labor: 901601, cogs: 604609, fixed: 214233, result: 126921 }),
  bea: annualRow({ revenue: 1501482, labor: 549600, cogs: 345077, fixed: 319408, result: 169001 }),
  lat: annualRow({ revenue: 1339960, labor: 591111, cogs: 409659, fixed: 274606, result: -78278 }),
}

function annualForYear (year: AccountingPnlYear): Record<AccountingPnlVenueId, AccountingPnlRow> | null {
  if (year === 2024) return ANNUAL_2024
  if (year === 2025) return ANNUAL_2025
  if (year === 2026) return YTD_2026
  return null
}

function monthlyForYear (year: AccountingPnlYear): Record<AccountingPnlVenueId, AccountingPnlRow[]> | null {
  if (year === 2024) {
    return {
      vkb: MONTHLY_2024.vkb.map(row),
      bea: MONTHLY_2024.bea.map(row),
      lat: MONTHLY_2024.lat.map(row),
    }
  }
  if (year === 2025) {
    return {
      vkb: MONTHLY_2025.vkb.map(row),
      bea: MONTHLY_2025.bea.map(row),
      lat: MONTHLY_2025.lat.map(row),
    }
  }
  if (year === 2026) {
    return {
      vkb: MONTHLY_2026.vkb.map(row),
      bea: MONTHLY_2026.bea.map(row),
      lat: MONTHLY_2026.lat.map(row),
    }
  }
  return null
}

export function accountingPnlYearLabel (year: AccountingPnlYear): string {
  if (year === 2026) return '2026 (Jan–Jul YTD)'
  return String(year)
}

export function accountingPnlMonthsForYear (year: AccountingPnlYear): number[] {
  if (year === 2026) return [1, 2, 3, 4, 5, 6, 7]
  return Array.from({ length: 12 }, (_, i) => i + 1)
}

export function accountingPnlHasMonthly (year: AccountingPnlYear): boolean {
  return accountingPnlMonthsForYear(year).length > 0
}

export function accountingPnlVenueRow (
  year: AccountingPnlYear,
  venueId: AccountingPnlVenueId,
  month: number | null,
): AccountingPnlRow | null {
  if (month == null) {
    return annualForYear(year)?.[venueId] ?? null
  }
  const monthly = monthlyForYear(year)
  if (!monthly || month < 1 || month > monthly[venueId].length) return null
  return monthly[venueId][month - 1] ?? null
}

export function accountingPnlYearTotals (
  year: AccountingPnlYear,
  venueId: AccountingPnlVenueId | 'combined',
): AccountingPnlRow | null {
  const annual = annualForYear(year)
  if (!annual) return null
  if (venueId === 'combined') return sumRows(Object.values(annual))
  return annual[venueId]
}

export type AccountingPnlTableLine = {
  key: string
  label: string
  row: AccountingPnlRow
}

export function accountingPnlTableLines (
  year: AccountingPnlYear,
  month: number | null,
): AccountingPnlTableLine[] {
  const lines: AccountingPnlTableLine[] = []
  for (const venue of ACCOUNTING_PNL_VENUES) {
    const base = month != null
      ? accountingPnlVenueRow(year, venue.id, month)
      : accountingPnlYearTotals(year, venue.id)
    if (!base) continue
    const withMix = accountingPnlRowWithMix(year, venue.id, month, base)
    lines.push({ key: venue.id, label: venue.label, row: withMix })
  }
  const combined = month != null
    ? (() => {
        const rows = lines.map((l) => l.row)
        return rows.length ? sumRows(rows) : null
      })()
    : (() => {
        const rows = ACCOUNTING_PNL_VENUES
          .map((v) => {
            const base = accountingPnlYearTotals(year, v.id)
            return base ? accountingPnlRowWithMix(year, v.id, null, base) : null
          })
          .filter((r): r is AccountingPnlRow => r != null)
        return rows.length ? sumRows(rows) : null
      })()
  if (combined && (month == null || lines.length === ACCOUNTING_PNL_VENUES.length)) {
    lines.push({ key: 'combined', label: 'Combined', row: combined })
  }
  return lines
}

export function accountingPnlPeriodLabel (
  year: AccountingPnlYear,
  viewMode: 'year' | 'month',
  month: number,
): string {
  if (viewMode === 'year') return accountingPnlYearLabel(year)
  return `${ACCOUNTING_PNL_MONTH_LABELS[month - 1] ?? ''} ${year}`
}
