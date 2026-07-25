/**
 * @registry-id: accountingPnlGrandchildLines
 * @created: 2026-07-23T15:40:00.000Z
 * @last-modified: 2026-07-23T17:05:00.000Z
 * @description: Analyse GL grandchildren under Revenue Food/Bev, COGS Food/Bev, Labor Lonen
 * @last-fix: [2026-07-23] BEA: verkoopkortingen, barOverigHoog, inhuurStewarding
 *
 * @exports-to:
 * ✓ utils/accountingPnlData.ts
 * ✓ utils/accountingPnlRowMath.ts
 * ✓ components/daily-ops/AccountingPnlSummaryTable.vue
 */

export const ACCOUNTING_PNL_REVENUE_FOOD_LINE_DEFS = [
  { key: 'bier', label: 'Omzet bier' },
  { key: 'snacks', label: 'Omzet snacks' },
  { key: 'lunch', label: 'Omzet lunch' },
  { key: 'diner', label: 'Omzet diner' },
  { key: 'menus', label: "Omzet menu's" },
  { key: 'keukenOverig', label: 'Omzet keuken overig' },
] as const

export const ACCOUNTING_PNL_REVENUE_BEV_LINE_DEFS = [
  { key: 'wijnen', label: 'Omzet wijnen' },
  { key: 'gedestilleerd', label: 'Omzet gedestilleerd' },
  { key: 'cocktails', label: 'Omzet cocktails' },
  { key: 'cider', label: 'Omzet cider' },
  { key: 'hoogOverig', label: 'Omzet hoog overig' },
  { key: 'warmeDranken', label: 'Omzet warme dranken' },
  { key: 'speciaalbierFles', label: 'Omzet speciaalbier fles' },
  { key: 'speciaalbierTap', label: 'Omzet speciaalbier tap' },
  { key: 'tapPilsner', label: 'Omzet tap pilsner' },
  { key: 'koffieThee', label: 'Omzet koffie / thee' },
  { key: 'frisdranken', label: 'Omzet frisdranken' },
  { key: 'alcoholVrij', label: 'Omzet alcohol vrij' },
  { key: 'laagOverig', label: 'Omzet laag overig' },
  { key: 'loterij', label: 'Omzet loterij' },
  { key: 'overigeOpbrengsten', label: 'Overige opbrengsten' },
  { key: 'verkoopkortingen', label: 'Verkoopkortingen' },
  { key: 'nonFood', label: 'Omzet non food' },
] as const

export const ACCOUNTING_PNL_COGS_FOOD_LINE_DEFS = [
  { key: 'keukenHoog', label: 'Inkopen keuken (hoog)' },
  { key: 'keukenLaag', label: 'Inkopen keuken (laag)' },
  { key: 'uitbesteed', label: 'Uitbesteed werk' },
] as const

export const ACCOUNTING_PNL_COGS_BEV_LINE_DEFS = [
  { key: 'bierenFles', label: 'Inkopen bieren fles' },
  { key: 'bierenLaag', label: 'Inkopen bieren (laag)' },
  { key: 'wijnen', label: 'Inkopen wijnen' },
  { key: 'sterke', label: 'Inkopen sterke dranken' },
  { key: 'speciaalFles', label: 'Inkopen speciaalbier fles' },
  { key: 'speciaalTap', label: 'Inkopen speciaalbier tap' },
  { key: 'pils', label: 'Inkopen pilsner' },
  { key: 'koffie', label: 'Inkopen koffie' },
  { key: 'fris', label: 'Inkopen frisdrank' },
  { key: 'alcoholvrij', label: 'Inkopen alcoholvrij' },
  { key: 'barOverigHoog', label: 'Inkopen bar overig (hoog)' },
  { key: 'inkopenOverigHoog', label: 'Inkopen overig (hoog)' },
  { key: 'barOverige', label: 'Inkopen bar overige' },
  { key: 'inkoopkortingen', label: 'Inkoopkortingen / bonussen' },
  { key: 'statiegeld', label: 'Statiegeld' },
] as const

export const ACCOUNTING_PNL_LABOR_LONEN_LINE_DEFS = [
  { key: 'salarisBediening', label: 'Bruto Salarissen Bediening' },
  { key: 'salarisKeuken', label: 'Bruto Salarissen Keuken' },
  { key: 'salarisOverhead', label: 'Bruto Salarissen Overhead' },
  { key: 'inhuurFb', label: 'Inhuur F&B' },
  { key: 'inhuurAfwas', label: 'Inhuur Afwas' },
  { key: 'inhuurStewarding', label: 'Inhuur Stewarding' },
  { key: 'inhuurKeuken', label: 'Inhuur keuken' },
  { key: 'inhuurOverhead', label: 'Inhuur overhead' },
  { key: 'overigLonen', label: 'Overig Lonen (mutaties / doorberekening)' },
] as const

export type AccountingPnlRevenueFoodLineKey =
  (typeof ACCOUNTING_PNL_REVENUE_FOOD_LINE_DEFS)[number]['key']
export type AccountingPnlRevenueBevLineKey =
  (typeof ACCOUNTING_PNL_REVENUE_BEV_LINE_DEFS)[number]['key']
export type AccountingPnlCogsFoodLineKey =
  (typeof ACCOUNTING_PNL_COGS_FOOD_LINE_DEFS)[number]['key']
export type AccountingPnlCogsBevLineKey =
  (typeof ACCOUNTING_PNL_COGS_BEV_LINE_DEFS)[number]['key']
export type AccountingPnlLaborLonenLineKey =
  (typeof ACCOUNTING_PNL_LABOR_LONEN_LINE_DEFS)[number]['key']

export type AccountingPnlRevenueFoodLines = Record<AccountingPnlRevenueFoodLineKey, number>
export type AccountingPnlRevenueBevLines = Record<AccountingPnlRevenueBevLineKey, number>
export type AccountingPnlCogsFoodLines = Record<AccountingPnlCogsFoodLineKey, number>
export type AccountingPnlCogsBevLines = Record<AccountingPnlCogsBevLineKey, number>
export type AccountingPnlLaborLonenLines = Record<AccountingPnlLaborLonenLineKey, number>

export type AccountingPnlLineGroup =
  | 'revenueFoodLines'
  | 'revenueBevLines'
  | 'cogsFoodLines'
  | 'cogsBevLines'
  | 'laborLonenLines'

function emptyFromDefs<T extends readonly { key: string }[]> (
  defs: T,
): Record<T[number]['key'], number> {
  const out = {} as Record<T[number]['key'], number>
  for (const d of defs) out[d.key as T[number]['key']] = 0
  return out
}

export function emptyRevenueFoodLines (): AccountingPnlRevenueFoodLines {
  return emptyFromDefs(ACCOUNTING_PNL_REVENUE_FOOD_LINE_DEFS)
}

export function emptyRevenueBevLines (): AccountingPnlRevenueBevLines {
  return emptyFromDefs(ACCOUNTING_PNL_REVENUE_BEV_LINE_DEFS)
}

export function emptyCogsFoodLines (): AccountingPnlCogsFoodLines {
  return emptyFromDefs(ACCOUNTING_PNL_COGS_FOOD_LINE_DEFS)
}

export function emptyCogsBevLines (): AccountingPnlCogsBevLines {
  return emptyFromDefs(ACCOUNTING_PNL_COGS_BEV_LINE_DEFS)
}

export function emptyLaborLonenLines (): AccountingPnlLaborLonenLines {
  return emptyFromDefs(ACCOUNTING_PNL_LABOR_LONEN_LINE_DEFS)
}

function num (value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeLines<T extends Record<string, number>> (
  empty: () => T,
  raw: Partial<T> | null | undefined,
): T {
  const base = empty()
  if (!raw || typeof raw !== 'object') return base
  for (const key of Object.keys(base) as (keyof T)[]) {
    base[key] = num(raw[key]) as T[keyof T]
  }
  return base
}

export function normalizeRevenueFoodLines (
  raw: Partial<AccountingPnlRevenueFoodLines> | null | undefined,
): AccountingPnlRevenueFoodLines {
  return normalizeLines(emptyRevenueFoodLines, raw)
}

export function normalizeRevenueBevLines (
  raw: Partial<AccountingPnlRevenueBevLines> | null | undefined,
): AccountingPnlRevenueBevLines {
  return normalizeLines(emptyRevenueBevLines, raw)
}

export function normalizeCogsFoodLines (
  raw: Partial<AccountingPnlCogsFoodLines> | null | undefined,
): AccountingPnlCogsFoodLines {
  return normalizeLines(emptyCogsFoodLines, raw)
}

export function normalizeCogsBevLines (
  raw: Partial<AccountingPnlCogsBevLines> | null | undefined,
): AccountingPnlCogsBevLines {
  return normalizeLines(emptyCogsBevLines, raw)
}

export function normalizeLaborLonenLines (
  raw: Partial<AccountingPnlLaborLonenLines> | null | undefined,
): AccountingPnlLaborLonenLines {
  return normalizeLines(emptyLaborLonenLines, raw)
}

export function sumLineValues (lines: Record<string, number>): number {
  return Object.values(lines).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
}

export function sumLineMaps<T extends Record<string, number>> (
  empty: () => T,
  maps: T[],
): T {
  const out = empty()
  for (const map of maps) {
    for (const key of Object.keys(out) as (keyof T)[]) {
      out[key] = (num(out[key]) + num(map[key])) as T[keyof T]
    }
  }
  return out
}

export function accountingPnlHasGrandchildLines (row: {
  revenueFoodLines?: Partial<AccountingPnlRevenueFoodLines> | null
  revenueBevLines?: Partial<AccountingPnlRevenueBevLines> | null
  cogsFoodLines?: Partial<AccountingPnlCogsFoodLines> | null
  cogsBevLines?: Partial<AccountingPnlCogsBevLines> | null
  laborLonenLines?: Partial<AccountingPnlLaborLonenLines> | null
}): boolean {
  return sumLineValues(normalizeRevenueFoodLines(row.revenueFoodLines)) > 0
    || sumLineValues(normalizeRevenueBevLines(row.revenueBevLines)) > 0
    || sumLineValues(normalizeCogsFoodLines(row.cogsFoodLines)) > 0
    || sumLineValues(normalizeCogsBevLines(row.cogsBevLines)) > 0
    || sumLineValues(normalizeLaborLonenLines(row.laborLonenLines)) > 0
}
