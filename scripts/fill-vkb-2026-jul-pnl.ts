/**
 * One-shot: fill VKB 2026 July accounting P&L from Analyse screenshots.
 * Preserves BEA/LAT from GET (empty if missing).
 *
 * Run: npx --yes tsx scripts/fill-vkb-2026-jul-pnl.ts
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

function buildVkbJuly (): AccountingPnlRow {
  return sealAccountingPnlRow({
    revenueFoodLines: {
      ...emptyRevenueFoodLines(),
      bier: 0,
      snacks: 15820,
      lunch: 14030,
      diner: 53350,
      menus: 295,
      keukenOverig: 0,
    },
    revenueBevLines: {
      ...emptyRevenueBevLines(),
      wijnen: 13704,
      gedestilleerd: 9487,
      cocktails: 6513,
      cider: 446,
      hoogOverig: 0,
      warmeDranken: 0,
      speciaalbierFles: 2266,
      speciaalbierTap: 21357,
      tapPilsner: 9594,
      koffieThee: 6325,
      frisdranken: 14967,
      alcoholVrij: 4783,
      laagOverig: 1843,
      loterij: 0,
      overigeOpbrengsten: 0,
      nonFood: 0,
    },
    cogsFoodLines: {
      ...emptyCogsFoodLines(),
      keukenHoog: 635,
      keukenLaag: 26160,
      uitbesteed: 0,
    },
    cogsBevLines: {
      ...emptyCogsBevLines(),
      bierenFles: 228,
      bierenLaag: 87,
      wijnen: 2834,
      sterke: 3717,
      speciaalFles: 453,
      speciaalTap: 8718,
      pils: 1616,
      koffie: 1308,
      fris: 3515,
      alcoholvrij: 3400,
      barOverige: 1298,
      inkoopkortingen: 0,
      statiegeld: 0,
    },
    laborLonenLines: {
      ...emptyLaborLonenLines(),
      salarisBediening: 16978,
      salarisKeuken: 15361,
      salarisOverhead: 0,
      inhuurFb: 13311,
      inhuurAfwas: 4787,
      inhuurKeuken: 10025,
      inhuurOverhead: 3533,
      /** Residual: doorberekening + vakantie mutaties + ziekengeld → Lonen = 50.413 */
      overigLonen: -13582,
    },
    laborSocialeLasten: 5957,
    laborPensioen: 1658,
    laborOverig: 500,
    fixedOverige: 32289,
    fixedAfschrijving: 9662,
    fixedFinancieel: 0,
    fixedOpbrengstVorderingen: -600,
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
  const existing = await fetchMonth(7)
  const vkb = buildVkbJuly()
  console.log(
    'jul vkb',
    `rev=${vkb.revenue}`,
    `cogs=${vkb.cogs}`,
    `labor=${vkb.labor}`,
    `fixed=${vkb.fixed}`,
    `result=${vkb.result}`,
  )

  const put = await fetch(`${BASE}/api/daily-ops/finance/pnl`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      periods: [{
        year: 2026,
        month: 7,
        venues: {
          vkb,
          bea: existing?.bea ?? normalizeAccountingPnlRow({}),
          lat: existing?.lat ?? normalizeAccountingPnlRow({}),
        },
      }],
      refreshAssumptions: false,
    }),
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
