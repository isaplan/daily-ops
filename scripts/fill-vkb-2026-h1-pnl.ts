/**
 * One-shot: fill VKB 2026 Jan–Jun accounting P&L from Analyse screenshots.
 * Preserves BEA/LAT from GET; creates empty BEA/LAT for June if missing.
 *
 * Run: npx --yes tsx scripts/fill-vkb-2026-h1-pnl.ts
 */

import { sealAccountingPnlRow, normalizeAccountingPnlRow } from '../utils/accountingPnlRowMath'
import {
  emptyCogsBevLines,
  emptyCogsFoodLines,
  emptyLaborLonenLines,
  emptyRevenueBevLines,
  emptyRevenueFoodLines,
} from '../utils/accountingPnlGrandchildLines'
import type { AccountingPnlRow } from '../utils/accountingPnlData'

const BASE = process.env.PNL_API_BASE ?? 'http://localhost:8080'

const M = [0, 1, 2, 3, 4, 5] as const // indices into monthly arrays

const revFood = {
  bier: [-3107, 0, 0, 0, 0, 0],
  snacks: [7377, 7586, 11397, 15455, 14301, 14196],
  lunch: [13540, 11936, 17264, 14648, 14863, 11909],
  diner: [36922, 41476, 47361, 49463, 50019, 49824],
  menus: [69, 140, 502, 151, 426, 224],
  keukenOverig: [0, 0, 0, 0, 0, 0],
}

const revBev = {
  wijnen: [10386, 10911, 13771, 15808, 11930, 12246],
  gedestilleerd: [2320, 4264, 4731, 2501, 6807, 8534],
  cocktails: [4485, 5865, 7673, 11428, 7180, 4987],
  cider: [124, 199, 278, 331, 315, 292],
  hoogOverig: [0, 0, 0, 0, 0, 0],
  warmeDranken: [0, 0, 0, 0, 0, 0],
  speciaalbierFles: [1282, 1465, 2016, 2643, 2201, 1434],
  speciaalbierTap: [12777, 14215, 18956, 22549, 21518, 19321],
  tapPilsner: [6780, 3812, 5294, 8801, 6411, 12550],
  koffieThee: [8710, 7703, 9081, 7272, 6493, 5378],
  frisdranken: [7993, 8079, 10160, 12060, 12097, 15627],
  alcoholVrij: [3252, 2499, 3368, 4206, 4126, 4559],
  laagOverig: [236, 3167, 5759, 6490, 1039, 262],
  loterij: [0, 0, 150, 0, 0, 0],
  overigeOpbrengsten: [0, 1875, 838, 0, 0, 0],
  nonFood: [0, 0, 0, 0, 0, 0],
}

const cogsFood = {
  keukenHoog: [631, 646, 647, 671, 606, 699],
  keukenLaag: [25727, 19856, 28999, 29248, 25829, 28144],
  uitbesteed: [0, 0, 0, 0, 0, 0],
}

/** Positive = cost; negative = credit (korting / credit note). */
const cogsBev = {
  bierenFles: [-9, 77, 294, 79, 153, 232],
  bierenLaag: [-264, -238, 176, -22, -142, 68],
  wijnen: [4128, 3996, 3267, 2438, 6358, 6168],
  sterke: [1189, 1726, 2045, 4626, 2638, 1794],
  speciaalFles: [171, 428, 446, 906, 355, 92],
  speciaalTap: [5333, 5877, 6940, 9336, 8214, 5336],
  pils: [2877, 2591, 3341, 5730, 1909, 6527],
  koffie: [1415, 1219, 1715, 1310, 1359, 1287],
  fris: [1894, 2143, 2001, 3264, 2927, 3330],
  alcoholvrij: [405, 927, 1067, 1292, 1321, 2279],
  barOverige: [1351, 858, 1578, 1431, 1122, 1212],
  inkoopkortingen: [0, 0, -41, -2000, 0, 0],
  statiegeld: [0, 0, 0, 0, 0, 0],
}

const laborLonen = {
  salarisBediening: [17933, 18029, 17984, 13522, 14259, 17518],
  salarisKeuken: [17763, 17685, 18861, 15948, 17861, 15828],
  salarisOverhead: [0, 0, 0, 0, 0, 0],
  inhuurFb: [8128, 9621, 12667, 14594, 14268, 11893],
  inhuurAfwas: [4556, 4286, 4118, 4674, 4961, 4489],
  inhuurKeuken: [2422, 3352, 3791, 6177, 4485, 7375],
  inhuurOverhead: [1058, 1140, 3650, 2118, 1328, 1658],
  /** Residual so Lonen matches Analyse (doorberekende + vakantie mutaties + ziekengeld). */
  overigLonen: [4889, 424, -4693, -6390, 5164, -672],
}

const laborSociale = [6311, 6319, 7399, 5281, 6184, 10436]
const laborPensioen = [1823, 1825, 2052, 1267, 1941, 3910]
const laborOverig = [650, 650, 650, 500, 500, 500]

const fixedOverige = [32212, 35490, 38962, 36626, 37064, 38491]
const fixedAfschrijving = [9689, 9689, 9688, 9689, 9689, 9688]
const fixedFinancieel = [0, 0, 203, 0, 0, 0]
/** Income — signed negative so Fixed = sum(children) stays consistent. */
const fixedOpbrengstVorderingen = [-600, -600, -600, -600, -600, -600]

function pick<T extends Record<string, number[]>> (map: T, i: number): { [K in keyof T]: number } {
  const out = {} as { [K in keyof T]: number }
  for (const key of Object.keys(map) as (keyof T)[]) {
    out[key] = map[key][i] ?? 0
  }
  return out
}

function buildVkbMonth (i: number): AccountingPnlRow {
  return sealAccountingPnlRow({
    revenueFoodLines: { ...emptyRevenueFoodLines(), ...pick(revFood, i) },
    revenueBevLines: { ...emptyRevenueBevLines(), ...pick(revBev, i) },
    cogsFoodLines: { ...emptyCogsFoodLines(), ...pick(cogsFood, i) },
    cogsBevLines: { ...emptyCogsBevLines(), ...pick(cogsBev, i) },
    laborLonenLines: { ...emptyLaborLonenLines(), ...pick(laborLonen, i) },
    laborSocialeLasten: laborSociale[i],
    laborPensioen: laborPensioen[i],
    laborOverig: laborOverig[i],
    fixedOverige: fixedOverige[i],
    fixedAfschrijving: fixedAfschrijving[i],
    fixedFinancieel: fixedFinancieel[i],
    fixedOpbrengstVorderingen: fixedOpbrengstVorderingen[i],
  })
}

async function fetchMonth (month: number): Promise<Record<'vkb' | 'bea' | 'lat', AccountingPnlRow> | null> {
  const res = await fetch(`${BASE}/api/daily-ops/finance/pnl?year=2026&month=${month}`)
  if (!res.ok) return null
  const data = await res.json() as {
    lines?: Array<{ key: string; row: AccountingPnlRow }>
  }
  const byKey = Object.fromEntries((data.lines ?? []).map((l) => [l.key, normalizeAccountingPnlRow(l.row)]))
  if (!byKey.vkb && !byKey.bea && !byKey.lat) return null
  return {
    vkb: byKey.vkb ?? normalizeAccountingPnlRow({}),
    bea: byKey.bea ?? normalizeAccountingPnlRow({}),
    lat: byKey.lat ?? normalizeAccountingPnlRow({}),
  }
}

async function main () {
  const periods: Array<{
    year: number
    month: number
    venues: Record<'vkb' | 'bea' | 'lat', AccountingPnlRow>
  }> = []

  for (const i of M) {
    const month = i + 1
    const existing = await fetchMonth(month)
    const vkb = buildVkbMonth(i)
    periods.push({
      year: 2026,
      month,
      venues: {
        vkb,
        bea: existing?.bea ?? normalizeAccountingPnlRow({}),
        lat: existing?.lat ?? normalizeAccountingPnlRow({}),
      },
    })
    console.log(
      `m${month}`,
      `rev=${vkb.revenue}`,
      `cogs=${vkb.cogs}`,
      `labor=${vkb.labor}`,
      `fixed=${vkb.fixed}`,
      `result=${vkb.result}`,
    )
  }

  const put = await fetch(`${BASE}/api/daily-ops/finance/pnl`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ periods, refreshAssumptions: false }),
  })
  const body = await put.text()
  if (!put.ok) {
    console.error('PUT failed', put.status, body)
    process.exit(1)
  }
  console.log('PUT ok', body)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
