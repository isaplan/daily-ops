/**
 * @registry-id: accountingPnlRowMath
 * @created: 2026-07-16T00:00:00.000Z
 * @last-modified: 2026-07-16T00:00:00.000Z
 * @description: Sum / seal / normalize accounting P&L rows (parents from children).
 * @last-fix: [2026-07-16] Labor + fixed child fields; seal on save
 *
 * @exports-to:
 * ✓ utils/accountingPnlData.ts
 * ✓ utils/accountingPnlMixData.ts
 * ✓ components/daily-ops/AccountingPnlSummaryTable.vue
 * ✓ server/utils/accountingPnlBenchmarkService.ts
 */

import type { AccountingPnlRow } from '~/utils/accountingPnlData'

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

const ZERO_ROW: AccountingPnlRow = {
  revenue: 0,
  revenueFood: 0,
  revenueBeverage: 0,
  cogs: 0,
  cogsFood: 0,
  cogsBeverage: 0,
  labor: 0,
  laborLonen: 0,
  laborSocialeLasten: 0,
  laborPensioen: 0,
  laborOverig: 0,
  fixed: 0,
  fixedOverige: 0,
  fixedAfschrijving: 0,
  fixedFinancieel: 0,
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
  return {
    revenue,
    revenueFood: num(raw?.revenueFood),
    revenueBeverage: num(raw?.revenueBeverage),
    cogs,
    cogsFood: num(raw?.cogsFood),
    cogsBeverage: raw?.cogsBeverage != null ? num(raw.cogsBeverage) : cogs,
    labor,
    laborLonen,
    laborSocialeLasten,
    laborPensioen,
    laborOverig,
    fixed,
    fixedOverige,
    fixedAfschrijving,
    fixedFinancieel,
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
        cogs: acc.cogs + r.cogs,
        cogsFood: acc.cogsFood + r.cogsFood,
        cogsBeverage: acc.cogsBeverage + r.cogsBeverage,
        labor: acc.labor + r.labor,
        laborLonen: acc.laborLonen + r.laborLonen,
        laborSocialeLasten: acc.laborSocialeLasten + r.laborSocialeLasten,
        laborPensioen: acc.laborPensioen + r.laborPensioen,
        laborOverig: acc.laborOverig + r.laborOverig,
        fixed: acc.fixed + r.fixed,
        fixedOverige: acc.fixedOverige + r.fixedOverige,
        fixedAfschrijving: acc.fixedAfschrijving + r.fixedAfschrijving,
        fixedFinancieel: acc.fixedFinancieel + r.fixedFinancieel,
        result: acc.result + r.result,
      }
    },
    { ...ZERO_ROW },
  )
}

/** Parents from children when children present; result = rev − cogs − labor − fixed. */
export function sealAccountingPnlRow (raw: Partial<AccountingPnlRow>): AccountingPnlRow {
  const row = normalizeAccountingPnlRow(raw)
  const revMix = row.revenueFood + row.revenueBeverage
  const cogsMix = row.cogsFood + row.cogsBeverage
  const laborMix = row.laborLonen + row.laborSocialeLasten + row.laborPensioen + row.laborOverig
  const fixedMix = row.fixedOverige + row.fixedAfschrijving + row.fixedFinancieel

  const revenue = revMix > 0 ? revMix : row.revenue
  const cogs = cogsMix > 0 ? cogsMix : row.cogs
  const labor = laborMix > 0 ? laborMix : row.labor
  const fixed = fixedMix > 0 ? fixedMix : row.fixed

  return {
    ...row,
    revenue,
    revenueFood: revMix > 0 ? row.revenueFood : 0,
    revenueBeverage: revMix > 0 ? row.revenueBeverage : 0,
    cogs,
    cogsFood: cogsMix > 0 ? row.cogsFood : 0,
    cogsBeverage: cogsMix > 0 ? row.cogsBeverage : cogs,
    labor,
    laborLonen: laborMix > 0 ? row.laborLonen : labor,
    laborSocialeLasten: laborMix > 0 ? row.laborSocialeLasten : 0,
    laborPensioen: laborMix > 0 ? row.laborPensioen : 0,
    laborOverig: laborMix > 0 ? row.laborOverig : 0,
    fixed,
    fixedOverige: fixedMix > 0 ? row.fixedOverige : fixed,
    fixedAfschrijving: fixedMix > 0 ? row.fixedAfschrijving : 0,
    fixedFinancieel: fixedMix > 0 ? row.fixedFinancieel : 0,
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
  } else if (field === 'cogs') {
    next.cogsFood = 0
    next.cogsBeverage = value
  } else if (field === 'labor') {
    next.laborLonen = value
    next.laborSocialeLasten = 0
    next.laborPensioen = 0
    next.laborOverig = 0
  } else if (field === 'fixed') {
    next.fixedOverige = value
    next.fixedAfschrijving = 0
    next.fixedFinancieel = 0
  }
  return sealAccountingPnlRow(next)
}

export function accountingPnlHasLaborBreakdown (row: AccountingPnlRow): boolean {
  const r = normalizeAccountingPnlRow(row)
  return r.laborSocialeLasten + r.laborPensioen + r.laborOverig > 0
    || (r.laborLonen > 0 && r.laborLonen !== r.labor)
}

export function accountingPnlHasFixedBreakdown (row: AccountingPnlRow): boolean {
  const r = normalizeAccountingPnlRow(row)
  return r.fixedAfschrijving + r.fixedFinancieel > 0
    || (r.fixedOverige > 0 && r.fixedOverige !== r.fixed)
}
