/**
 * Food / beverage revenue & COGS mix from *Analyse* exports.
 * Beverage revenue = handelsgoederen (BEA/LAT) or groepen (VKB).
 * COGS food = inkopen keuken (Power BI) + uitbesteed werk (Analyse, BEA); bev = remainder of net COGS.
 */

import type { AccountingPnlRow, AccountingPnlVenueId, AccountingPnlYear } from '~/utils/accountingPnlData'

export type AccountingPnlMixSlice = {
  revenueFood: number
  revenueBeverage: number
  cogsFood: number
  cogsBeverage: number
}

type MixArrays = {
  revenueFood: number[]
  revenueBeverage: number[]
  cogsFood?: number[]
  cogsBeverage?: number[]
}

const REV_FOOD_2024: Record<AccountingPnlVenueId, number[]> = {
  vkb: [89910, 90060, 112513, 100900, 112128, 103947, 111621, 106444, 77670, 84410, 93579, 92503],
  bea: [36842, 37718, 60731, 54360, 55264, 49116, 46983, 52667, 39063, 39074, 41419, 33720],
  lat: [60075, 101696, 98675, 93554, 101867, 105382, 94670, 97550, 82648, 82213, 85513, 90868],
}

const REV_BEV_2024: Record<AccountingPnlVenueId, number[]> = {
  vkb: [70939, 71833, 92113, 90424, 91480, 102482, 118364, 98074, 75952, 70971, 86316, 139547],
  bea: [59361, 63763, 86065, 93343, 97482, 94834, 90456, 100774, 76150, 76203, 81599, 62492],
  lat: [41060, 64819, 62021, 66635, 73251, 69784, 67996, 67397, 54937, 57904, 50098, 51827],
}

const REV_FOOD_2025: Record<AccountingPnlVenueId, number[]> = {
  vkb: [74832, 68671, 89015, 94846, 98745, 91254, 94010, 91878, 69939, 81042, 77632, 75963],
  bea: [32903, 37949, 51552, 45585, 55483, 40542, 45504, 41678, 28715, 32572, 31930, 36661],
  lat: [66376, 57026, 72478, 74218, 79648, 64086, 65357, 54309, 49389, 61699, 58854, 91712],
}

const REV_BEV_2025: Record<AccountingPnlVenueId, number[]> = {
  vkb: [66649, 59094, 83595, 88867, 86347, 81878, 94337, 79391, 68103, 73799, 76378, 110507],
  bea: [61129, 70922, 97768, 98079, 111786, 83030, 94282, 88048, 81989, 82022, 80908, 70611],
  lat: [41243, 34172, 54206, 60002, 61931, 48944, 48164, 38748, 35104, 39296, 35851, 47147],
}

const REV_FOOD_2026: Record<AccountingPnlVenueId, number[]> = {
  vkb: [54799, 61139, 76523, 79717, 79609],
  bea: [27509, 25985, 39132, 30135, 38729],
  lat: [54006, 44777, 44533, 50162, 42014],
}

const REV_BEV_2026: Record<AccountingPnlVenueId, number[]> = {
  vkb: [58345, 64055, 82075, 94089, 80115],
  bea: [64732, 67888, 91174, 136657, 105679],
  lat: [31075, 29795, 38897, 44698, 38281],
}

/** Keuken (Power BI), bonus pro-rata on net COGS — VKB/LAT/BEA 2024. */
const COGS_FOOD_2024: Partial<Record<AccountingPnlVenueId, number[]>> = {
  vkb: [33512, 34901, 42792, 31139, 37673, 37316, 34683, 40493, 30167, 38909, 31128, 10807],
  lat: [23094, 37532, 50580, 31125, 48158, 36882, 26683, 39001, 31894, 33795, 26732, 12927],
  bea: [13266, 13138, 15443, 17803, 16741, 15582, 14303, 16466, 11856, 12369, 13876, 18514],
}

const COGS_BEV_2024: Partial<Record<AccountingPnlVenueId, number[]>> = {
  vkb: [17010, 19793, 28018, 25461, 26801, 30795, 35220, 24467, 17848, 16888, 21772, 9774],
  lat: [14379, 22251, 22530, 22447, 20143, 21466, 21100, 20645, 18629, 15945, 15761, 5855],
  bea: [22268, 22200, 31704, 31574, 33097, 33170, 27523, 31409, 24719, 24805, 26306, 24203],
}

/** Keuken hoog+laag (Power BI), bonus pro-rata on net COGS — VKB/LAT/BEA 2025. */
const COGS_FOOD_2025: Partial<Record<AccountingPnlVenueId, number[]>> = {
  vkb: [25192, 29258, 42144, 37096, 34578, 37211, 37144, 32309, 26424, 25764, 30138, 2884],
  lat: [21028, 16047, 27831, 36843, 32947, 30487, 21183, 20148, 20009, 19846, 21286, 829],
  bea: [8996, 7760, 13105, 10826, 12291, 9965, 8623, 8742, 7288, 6428, 8303, 28172],
}

const COGS_BEV_2025: Partial<Record<AccountingPnlVenueId, number[]>> = {
  vkb: [21057, 15655, 30342, 20033, 28120, 23512, 24341, 23842, 19144, 23553, 24655, 4019],
  lat: [11798, 10089, 14097, 17010, 19761, 14853, 12362, 12097, 10674, 10158, 10442, 508],
  bea: [20410, 22628, 37619, 34420, 33567, 28579, 29981, 33668, 27285, 17141, 30222, 44598],
}

/** Keuken hoog+laag (Power BI 2026) + BEA uitbesteed werk (Analyse). */
const COGS_FOOD_2026: Record<AccountingPnlVenueId, number[]> = {
  vkb: [26358, 20424, 29450, 29909, 29956],
  bea: [11505, 11290, 16635, 13950, 13974],
  lat: [0, 0, 0, 0, 0],
}

/** Net COGS − food (accounting headline totals). */
const COGS_BEV_2026: Record<AccountingPnlVenueId, number[]> = {
  vkb: [18489, 19603, 22828, 28391, 24598],
  bea: [19117, 25684, 27263, 40802, 29005],
  lat: [27980, 34343, 29817, 29208, 30048],
}

const ANNUAL_MIX: Record<AccountingPnlYear, Record<AccountingPnlVenueId, AccountingPnlMixSlice>> = {
  2024: {
    vkb: { revenueFood: 1_175_685, revenueBeverage: 1_108_495, cogsFood: 403_520, cogsBeverage: 273_847 },
    bea: { revenueFood: 546_957, revenueBeverage: 982_522, cogsFood: 179_357, cogsBeverage: 247_544 },
    lat: { revenueFood: 1_094_711, revenueBeverage: 727_729, cogsFood: 398_403, cogsBeverage: 221_151 },
  },
  2025: {
    vkb: { revenueFood: 1_007_827, revenueBeverage: 968_945, cogsFood: 360_142, cogsBeverage: 244_467 },
    bea: { revenueFood: 481_074, revenueBeverage: 1_020_574, cogsFood: 130_500, cogsBeverage: 214_577 },
    lat: { revenueFood: 795_152, revenueBeverage: 544_808, cogsFood: 268_484, cogsBeverage: 141_175 },
  },
  2026: {
    vkb: { revenueFood: 351_787, revenueBeverage: 378_679, cogsFood: 136_097, cogsBeverage: 113_909 },
    bea: { revenueFood: 161_490, revenueBeverage: 466_130, cogsFood: 67_354, cogsBeverage: 141_871 },
    lat: { revenueFood: 235_492, revenueBeverage: 182_746, cogsFood: 0, cogsBeverage: 151_565 },
  },
}

function deriveCogs (base: AccountingPnlRow, mix: Partial<AccountingPnlMixSlice>): AccountingPnlMixSlice {
  const revenueFood = mix.revenueFood ?? 0
  const revenueBeverage = mix.revenueBeverage ?? 0
  const cogsFoodExplicit = mix.cogsFood
  const cogsBevExplicit = mix.cogsBeverage

  if (cogsFoodExplicit != null && cogsBevExplicit != null) {
    const sum = cogsFoodExplicit + cogsBevExplicit
    if (sum === base.cogs) {
      return { revenueFood, revenueBeverage, cogsFood: cogsFoodExplicit, cogsBeverage: cogsBevExplicit }
    }
    if (sum > base.cogs && cogsFoodExplicit <= base.cogs) {
      return {
        revenueFood,
        revenueBeverage,
        cogsFood: cogsFoodExplicit,
        cogsBeverage: Math.max(0, base.cogs - cogsFoodExplicit),
      }
    }
  }

  if (cogsFoodExplicit != null && cogsBevExplicit == null) {
    return {
      revenueFood,
      revenueBeverage,
      cogsFood: cogsFoodExplicit,
      cogsBeverage: Math.max(0, base.cogs - cogsFoodExplicit),
    }
  }

  if (cogsBevExplicit != null) {
    const cogsFood = Math.max(0, base.cogs - cogsBevExplicit)
    return {
      revenueFood,
      revenueBeverage,
      cogsFood,
      cogsBeverage: cogsFood > 0 ? Math.max(0, base.cogs - cogsFood) : base.cogs,
    }
  }

  return {
    revenueFood,
    revenueBeverage,
    cogsFood: 0,
    cogsBeverage: base.cogs,
  }
}

function monthlyArrays (
  year: AccountingPnlYear,
  venueId: AccountingPnlVenueId,
): MixArrays | null {
  if (year === 2024) {
    return {
      revenueFood: REV_FOOD_2024[venueId],
      revenueBeverage: REV_BEV_2024[venueId],
      cogsFood: COGS_FOOD_2024[venueId],
      cogsBeverage: COGS_BEV_2024[venueId],
    }
  }
  if (year === 2025) {
    return {
      revenueFood: REV_FOOD_2025[venueId],
      revenueBeverage: REV_BEV_2025[venueId],
      cogsFood: COGS_FOOD_2025[venueId],
      cogsBeverage: COGS_BEV_2025[venueId],
    }
  }
  if (year === 2026) {
    return {
      revenueFood: REV_FOOD_2026[venueId],
      revenueBeverage: REV_BEV_2026[venueId],
      cogsFood: COGS_FOOD_2026[venueId],
      cogsBeverage: COGS_BEV_2026[venueId],
    }
  }
  return null
}

export function accountingPnlMixForRow (
  year: AccountingPnlYear,
  venueId: AccountingPnlVenueId,
  month: number | null,
  base: AccountingPnlRow,
): AccountingPnlMixSlice {
  if (month == null) {
    const annual = ANNUAL_MIX[year]?.[venueId]
    if (annual) return deriveCogs(base, annual)
    return { revenueFood: 0, revenueBeverage: 0, cogsFood: 0, cogsBeverage: base.cogs }
  }

  const arrays = monthlyArrays(year, venueId)
  if (!arrays || month < 1 || month > arrays.revenueFood.length) {
    return { revenueFood: 0, revenueBeverage: 0, cogsFood: 0, cogsBeverage: base.cogs }
  }

  const idx = month - 1
  return deriveCogs(base, {
    revenueFood: arrays.revenueFood[idx],
    revenueBeverage: arrays.revenueBeverage[idx],
    cogsFood: arrays.cogsFood?.[idx],
    cogsBeverage: arrays.cogsBeverage?.[idx],
  })
}

export function accountingPnlRowWithMix (
  year: AccountingPnlYear,
  venueId: AccountingPnlVenueId,
  month: number | null,
  base: AccountingPnlRow,
): AccountingPnlRow {
  const mix = accountingPnlMixForRow(year, venueId, month, base)
  return { ...base, ...mix }
}

export function accountingPnlSumMix (slices: AccountingPnlMixSlice[]): AccountingPnlMixSlice {
  return slices.reduce(
    (acc, s) => ({
      revenueFood: acc.revenueFood + s.revenueFood,
      revenueBeverage: acc.revenueBeverage + s.revenueBeverage,
      cogsFood: acc.cogsFood + s.cogsFood,
      cogsBeverage: acc.cogsBeverage + s.cogsBeverage,
    }),
    { revenueFood: 0, revenueBeverage: 0, cogsFood: 0, cogsBeverage: 0 },
  )
}

export function accountingPnlHasMix (mix: AccountingPnlMixSlice): boolean {
  return mix.revenueFood + mix.revenueBeverage > 0
}
