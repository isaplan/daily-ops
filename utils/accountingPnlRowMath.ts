/**
 * @registry-id: accountingPnlRowMath
 * @created: 2026-07-16T00:00:00.000Z
 * @last-modified: 2026-07-23T17:00:00.000Z
 * @description: Sum / seal / normalize accounting P&L rows (parents from children + grandchildren).
 * @last-fix: [2026-07-23] Fixed child Opbrengst vorderingen (signed income)
 *
 * @exports-to:
 * ✓ utils/accountingPnlData.ts
 * ✓ utils/accountingPnlMixData.ts
 * ✓ components/daily-ops/AccountingPnlSummaryTable.vue
 * ✓ server/utils/accountingPnlBenchmarkService.ts
 */

import type { AccountingPnlRow } from '~/utils/accountingPnlData'
import {
  emptyCogsBevLines,
  emptyCogsFoodLines,
  emptyLaborLonenLines,
  emptyRevenueBevLines,
  emptyRevenueFoodLines,
  normalizeCogsBevLines,
  normalizeCogsFoodLines,
  normalizeLaborLonenLines,
  normalizeRevenueBevLines,
  normalizeRevenueFoodLines,
  sumLineMaps,
  sumLineValues,
  type AccountingPnlLineGroup,
} from '~/utils/accountingPnlGrandchildLines'

export type AccountingPnlEditableField =
  | 'revenue'
  | 'revenueFood'
  | 'revenueBeverage'
  | 'cogs'
  | 'cogsFood'
  | 'cogsBeverage'
  | 'labor'
  | 'laborLonen'
  | 'laborSocialeLasten'
  | 'laborPensioen'
  | 'laborOverig'
  | 'fixed'
  | 'fixedOverige'
  | 'fixedAfschrijving'
  | 'fixedFinancieel'
  | 'fixedOpbrengstVorderingen'

const ZERO_ROW: AccountingPnlRow = {
  revenue: 0,
  revenueFood: 0,
  revenueBeverage: 0,
  revenueFoodLines: emptyRevenueFoodLines(),
  revenueBevLines: emptyRevenueBevLines(),
  cogs: 0,
  cogsFood: 0,
  cogsBeverage: 0,
  cogsFoodLines: emptyCogsFoodLines(),
  cogsBevLines: emptyCogsBevLines(),
  labor: 0,
  laborLonen: 0,
  laborLonenLines: emptyLaborLonenLines(),
  laborSocialeLasten: 0,
  laborPensioen: 0,
  laborOverig: 0,
  fixed: 0,
  fixedOverige: 0,
  fixedAfschrijving: 0,
  fixedFinancieel: 0,
  fixedOpbrengstVorderingen: 0,
  result: 0,
}

function num (value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Fill missing labor/fixed children from parent totals (legacy Mongo docs). */
export function normalizeAccountingPnlRow (raw: Partial<AccountingPnlRow> | null | undefined): AccountingPnlRow {
  const revenue = num(raw?.revenue)
  const cogs = num(raw?.cogs)
  const labor = num(raw?.labor)
  const fixed = num(raw?.fixed)
  const laborLonen = raw?.laborLonen != null ? num(raw.laborLonen) : labor
  const laborSocialeLasten = num(raw?.laborSocialeLasten)
  const laborPensioen = num(raw?.laborPensioen)
  const laborOverig = num(raw?.laborOverig)
  const fixedOverige = raw?.fixedOverige != null ? num(raw.fixedOverige) : fixed
  const fixedAfschrijving = num(raw?.fixedAfschrijving)
  const fixedFinancieel = num(raw?.fixedFinancieel)
  const fixedOpbrengstVorderingen = num(raw?.fixedOpbrengstVorderingen)
  return {
    revenue,
    revenueFood: num(raw?.revenueFood),
    revenueBeverage: num(raw?.revenueBeverage),
    revenueFoodLines: normalizeRevenueFoodLines(raw?.revenueFoodLines),
    revenueBevLines: normalizeRevenueBevLines(raw?.revenueBevLines),
    cogs,
    cogsFood: num(raw?.cogsFood),
    cogsBeverage: raw?.cogsBeverage != null ? num(raw.cogsBeverage) : cogs,
    cogsFoodLines: normalizeCogsFoodLines(raw?.cogsFoodLines),
    cogsBevLines: normalizeCogsBevLines(raw?.cogsBevLines),
    labor,
    laborLonen,
    laborLonenLines: normalizeLaborLonenLines(raw?.laborLonenLines),
    laborSocialeLasten,
    laborPensioen,
    laborOverig,
    fixed,
    fixedOverige,
    fixedAfschrijving,
    fixedFinancieel,
    fixedOpbrengstVorderingen,
    result: num(raw?.result),
  }
}

export function sumAccountingPnlRows (rows: AccountingPnlRow[]): AccountingPnlRow {
  return rows.reduce(
    (acc, row) => {
      const r = normalizeAccountingPnlRow(row)
      return {
        revenue: acc.revenue + r.revenue,
        revenueFood: acc.revenueFood + r.revenueFood,
        revenueBeverage: acc.revenueBeverage + r.revenueBeverage,
        revenueFoodLines: sumLineMaps(emptyRevenueFoodLines, [acc.revenueFoodLines, r.revenueFoodLines]),
        revenueBevLines: sumLineMaps(emptyRevenueBevLines, [acc.revenueBevLines, r.revenueBevLines]),
        cogs: acc.cogs + r.cogs,
        cogsFood: acc.cogsFood + r.cogsFood,
        cogsBeverage: acc.cogsBeverage + r.cogsBeverage,
        cogsFoodLines: sumLineMaps(emptyCogsFoodLines, [acc.cogsFoodLines, r.cogsFoodLines]),
        cogsBevLines: sumLineMaps(emptyCogsBevLines, [acc.cogsBevLines, r.cogsBevLines]),
        labor: acc.labor + r.labor,
        laborLonen: acc.laborLonen + r.laborLonen,
        laborLonenLines: sumLineMaps(emptyLaborLonenLines, [acc.laborLonenLines, r.laborLonenLines]),
        laborSocialeLasten: acc.laborSocialeLasten + r.laborSocialeLasten,
        laborPensioen: acc.laborPensioen + r.laborPensioen,
        laborOverig: acc.laborOverig + r.laborOverig,
        fixed: acc.fixed + r.fixed,
        fixedOverige: acc.fixedOverige + r.fixedOverige,
        fixedAfschrijving: acc.fixedAfschrijving + r.fixedAfschrijving,
        fixedFinancieel: acc.fixedFinancieel + r.fixedFinancieel,
        fixedOpbrengstVorderingen: acc.fixedOpbrengstVorderingen + r.fixedOpbrengstVorderingen,
        result: acc.result + r.result,
      }
    },
    { ...ZERO_ROW, ...{
      revenueFoodLines: emptyRevenueFoodLines(),
      revenueBevLines: emptyRevenueBevLines(),
      cogsFoodLines: emptyCogsFoodLines(),
      cogsBevLines: emptyCogsBevLines(),
      laborLonenLines: emptyLaborLonenLines(),
    } },
  )
}

/** Grandchildren → children → parents; result = rev − cogs − labor − fixed. */
export function sealAccountingPnlRow (raw: Partial<AccountingPnlRow>): AccountingPnlRow {
  const row = normalizeAccountingPnlRow(raw)

  const foodLineSum = sumLineValues(row.revenueFoodLines)
  const bevLineSum = sumLineValues(row.revenueBevLines)
  const cogsFoodLineSum = sumLineValues(row.cogsFoodLines)
  const cogsBevLineSum = sumLineValues(row.cogsBevLines)
  const lonenLineSum = sumLineValues(row.laborLonenLines)

  const revenueFood = foodLineSum > 0 ? foodLineSum : row.revenueFood
  const revenueBeverage = bevLineSum > 0 ? bevLineSum : row.revenueBeverage
  const cogsFood = cogsFoodLineSum > 0 ? cogsFoodLineSum : row.cogsFood
  const cogsBeverage = cogsBevLineSum > 0 ? cogsBevLineSum : row.cogsBeverage
  const laborLonen = lonenLineSum > 0 ? lonenLineSum : row.laborLonen

  const revMix = revenueFood + revenueBeverage
  const cogsMix = cogsFood + cogsBeverage
  const laborMix = laborLonen + row.laborSocialeLasten + row.laborPensioen + row.laborOverig
  const fixedMix = row.fixedOverige + row.fixedAfschrijving + row.fixedFinancieel + row.fixedOpbrengstVorderingen
  const hasFixedMix = row.fixedOverige !== 0
    || row.fixedAfschrijving !== 0
    || row.fixedFinancieel !== 0
    || row.fixedOpbrengstVorderingen !== 0

  const revenue = revMix > 0 ? revMix : row.revenue
  const cogs = cogsMix > 0 ? cogsMix : row.cogs
  const labor = laborMix > 0 ? laborMix : row.labor
  const fixed = hasFixedMix ? fixedMix : row.fixed

  return {
    ...row,
    revenue,
    revenueFood: revMix > 0 ? revenueFood : 0,
    revenueBeverage: revMix > 0 ? revenueBeverage : 0,
    revenueFoodLines: foodLineSum > 0 ? row.revenueFoodLines : emptyRevenueFoodLines(),
    revenueBevLines: bevLineSum > 0 ? row.revenueBevLines : emptyRevenueBevLines(),
    cogs,
    cogsFood: cogsMix > 0 ? cogsFood : 0,
    cogsBeverage: cogsMix > 0 ? cogsBeverage : cogs,
    cogsFoodLines: cogsFoodLineSum > 0 ? row.cogsFoodLines : emptyCogsFoodLines(),
    cogsBevLines: cogsBevLineSum > 0 ? row.cogsBevLines : emptyCogsBevLines(),
    labor,
    laborLonen: laborMix > 0 ? laborLonen : labor,
    laborLonenLines: lonenLineSum > 0 ? row.laborLonenLines : emptyLaborLonenLines(),
    laborSocialeLasten: laborMix > 0 ? row.laborSocialeLasten : 0,
    laborPensioen: laborMix > 0 ? row.laborPensioen : 0,
    laborOverig: laborMix > 0 ? row.laborOverig : 0,
    fixed,
    fixedOverige: hasFixedMix ? row.fixedOverige : fixed,
    fixedAfschrijving: hasFixedMix ? row.fixedAfschrijving : 0,
    fixedFinancieel: hasFixedMix ? row.fixedFinancieel : 0,
    fixedOpbrengstVorderingen: hasFixedMix ? row.fixedOpbrengstVorderingen : 0,
    result: revenue - cogs - labor - fixed,
  }
}

export function applyAccountingPnlField (
  row: AccountingPnlRow,
  field: AccountingPnlEditableField,
  value: number,
): AccountingPnlRow {
  const next = { ...normalizeAccountingPnlRow(row), [field]: value }
  if (field === 'revenue') {
    next.revenueFood = 0
    next.revenueBeverage = 0
    next.revenueFoodLines = emptyRevenueFoodLines()
    next.revenueBevLines = emptyRevenueBevLines()
  } else if (field === 'revenueFood') {
    next.revenueFoodLines = emptyRevenueFoodLines()
  } else if (field === 'revenueBeverage') {
    next.revenueBevLines = emptyRevenueBevLines()
  } else if (field === 'cogs') {
    next.cogsFood = 0
    next.cogsBeverage = value
    next.cogsFoodLines = emptyCogsFoodLines()
    next.cogsBevLines = emptyCogsBevLines()
  } else if (field === 'cogsFood') {
    next.cogsFoodLines = emptyCogsFoodLines()
  } else if (field === 'cogsBeverage') {
    next.cogsBevLines = emptyCogsBevLines()
  } else if (field === 'labor') {
    next.laborLonen = value
    next.laborLonenLines = emptyLaborLonenLines()
    next.laborSocialeLasten = 0
    next.laborPensioen = 0
    next.laborOverig = 0
  } else if (field === 'laborLonen') {
    next.laborLonenLines = emptyLaborLonenLines()
  } else if (field === 'fixed') {
    next.fixedOverige = value
    next.fixedAfschrijving = 0
    next.fixedFinancieel = 0
    next.fixedOpbrengstVorderingen = 0
  }
  return sealAccountingPnlRow(next)
}

export function applyAccountingPnlLineField (
  row: AccountingPnlRow,
  group: AccountingPnlLineGroup,
  lineKey: string,
  value: number,
): AccountingPnlRow {
  const next = normalizeAccountingPnlRow(row)
  const groupMap = { ...next[group], [lineKey]: value }
  return sealAccountingPnlRow({ ...next, [group]: groupMap })
}

export function accountingPnlHasLaborBreakdown (row: AccountingPnlRow): boolean {
  const r = normalizeAccountingPnlRow(row)
  return r.laborSocialeLasten + r.laborPensioen + r.laborOverig > 0
    || (r.laborLonen > 0 && r.laborLonen !== r.labor)
    || sumLineValues(r.laborLonenLines) > 0
}

export function accountingPnlHasFixedBreakdown (row: AccountingPnlRow): boolean {
  const r = normalizeAccountingPnlRow(row)
  return r.fixedAfschrijving + r.fixedFinancieel !== 0
    || r.fixedOpbrengstVorderingen !== 0
    || (r.fixedOverige > 0 && r.fixedOverige !== r.fixed)
}
