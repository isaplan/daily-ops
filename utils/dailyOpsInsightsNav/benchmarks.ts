/**
 * @registry-id: dailyOpsInsightsBenchmarks
 * @created: 2026-06-30T22:00:00.000Z
 * @last-modified: 2026-06-30T22:00:00.000Z
 * @description: P&L benchmark profiles for Insights (targets + external branch refs)
 * @last-fix: [2026-06-30] Target, accounting, Sligro, Rabobank, FirmFocus
 *
 * @exports-to:
 * ✓ components/daily-ops/insights/InsightsBenchmarkPills.vue
 * ✓ components/daily-ops/insights/InsightsTrendSection.vue
 */

export const INSIGHTS_BENCHMARK_IDS = [
  'target',
  'pnl_accounting',
  'sligro',
  'rabobank',
  'firmfocus',
] as const

export type InsightsBenchmarkId = (typeof INSIGHTS_BENCHMARK_IDS)[number]

const BENCHMARK_SET = new Set<string>(INSIGHTS_BENCHMARK_IDS)

export type InsightsBenchmarkProfile = {
  id: InsightsBenchmarkId
  label: string
  shortLabel: string
  description: string
  sourceUrl: string
  sourceLabel: string
  referenceYear?: string
  /** Cost of sales / inkoop % of revenue */
  cogs_pct: number
  /** Loaded labor / personeel % of revenue */
  labor_pct: number
  /** Fixed + other opex % of revenue (excl. COGS & labor) */
  fixed_pct: number
  /** Net result % of revenue */
  net_pct: number
}

export const INSIGHTS_BENCHMARK_PROFILES: InsightsBenchmarkProfile[] = [
  {
    id: 'target',
    label: 'Target (internal)',
    shortLabel: 'Target',
    description: 'Ambition profile: 25% COGS · 30% labor · 35% other · 10% net.',
    sourceUrl: '',
    sourceLabel: 'Internal target',
    cogs_pct: 25,
    labor_pct: 30,
    fixed_pct: 35,
    net_pct: 10,
  },
  {
    id: 'pnl_accounting',
    label: 'P&L — real accounting',
    shortLabel: 'Accounting',
    description: 'Combined 3 venues, full-year 2025 (excl. afschrijving & financial).',
    sourceUrl: '/daily-ops/finance/pnl',
    sourceLabel: 'Daily Ops P&L',
    referenceYear: '2025',
    cogs_pct: 28,
    labor_pct: 42,
    fixed_pct: 17,
    net_pct: 5,
  },
  {
    id: 'sligro',
    label: 'Sligro — full service',
    shortLabel: 'Sligro',
    description: 'Kengetallen middensegment: inkoop 28–33%, personeel 30–35%, netto 3–5%. Midpoints shown.',
    sourceUrl: 'https://www.sligro.nl/inspiratie/rendement-kosten/kengetallen.html',
    sourceLabel: 'Sligro Kengetallen',
    referenceYear: '2025',
    cogs_pct: 30,
    labor_pct: 32,
    fixed_pct: 34,
    net_pct: 4,
  },
  {
    id: 'rabobank',
    label: 'Rabobank — eetgelegenheden',
    shortLabel: 'Rabobank',
    description: 'Personeelskosten nu 36–40% omzet (was 30–33% pre-COVID). Midpoint 38% labor.',
    sourceUrl: 'https://www.rabobank.nl/kennis/d011497899-personeelskosten-en-btw-verhoging-zetten-marges-in-horeca-onder-druk',
    sourceLabel: 'Rabobank sectoranalyse',
    referenceYear: '2024–2025',
    cogs_pct: 30,
    labor_pct: 38,
    fixed_pct: 27,
    net_pct: 5,
  },
  {
    id: 'firmfocus',
    label: 'FirmFocus — restaurants & cafetaria\'s',
    shortLabel: 'FirmFocus',
    description: 'SBI 56.1 branchegemiddelde (CBS / Belastingdienst), kostenstructuur 2022.',
    sourceUrl: 'https://www.firmfocus.biz/NL/BI/branche/restaurants-cafetaria',
    sourceLabel: 'FirmFocus branchecijfers',
    referenceYear: '2022',
    cogs_pct: 32,
    labor_pct: 29,
    fixed_pct: 29,
    net_pct: 11,
  },
]

export const DEFAULT_INSIGHTS_BENCHMARK_ID: InsightsBenchmarkId = 'target'

export function isInsightsBenchmarkId(raw: string): raw is InsightsBenchmarkId {
  return BENCHMARK_SET.has(raw)
}

export function coerceInsightsBenchmarkId(raw: string | undefined): InsightsBenchmarkId {
  if (raw && isInsightsBenchmarkId(raw)) return raw
  return DEFAULT_INSIGHTS_BENCHMARK_ID
}

export function insightsBenchmarkById(id: InsightsBenchmarkId): InsightsBenchmarkProfile {
  return INSIGHTS_BENCHMARK_PROFILES.find((p) => p.id === id) ?? INSIGHTS_BENCHMARK_PROFILES[0]!
}

export function benchmarkSummaryLine(p: InsightsBenchmarkProfile): string {
  const year = p.referenceYear ? ` (${p.referenceYear})` : ''
  return `${p.shortLabel}${year}: COGS ${p.cogs_pct}% · Labor ${p.labor_pct}% · Other ${p.fixed_pct}% · Net ${p.net_pct}%`
}
