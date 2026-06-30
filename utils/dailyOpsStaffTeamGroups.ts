/**
 * @registry-id: dailyOpsStaffTeamGroups
 * @created: 2026-06-26T20:00:00.000Z
 * @last-modified: 2026-06-26T20:00:00.000Z
 * @description: Canonical staff team groups + brand colors for totals chart
 * @last-fix: [2026-06-26] Merge duplicate Eitje team names into grouped pills
 *
 * @exports-to:
 * ✓ components/daily-ops/staff/StaffTotalsTab.vue
 */

export const STAFF_TEAM_KEUKEN = '#3D5276'
export const STAFF_TEAM_MANAGEMENT = '#4F74E3'
export const STAFF_TEAM_VERLOF = '#D9C73F'
export const STAFF_TEAM_ZIEK = '#C0392B'

export type StaffTeamGroupKey =
  | 'keuken'
  | 'bediening'
  | 'management'
  | 'afwas'
  | 'algemeen'
  | 'ziek'
  | 'verlof'
  | 'other'

export const STAFF_TEAM_GROUP_ORDER: StaffTeamGroupKey[] = [
  'keuken',
  'bediening',
  'management',
  'afwas',
  'algemeen',
  'ziek',
  'verlof',
  'other',
]

export const STAFF_TEAM_GROUP_LABELS: Record<StaffTeamGroupKey, string> = {
  keuken: 'Keuken',
  bediening: 'Bediening',
  management: 'Management',
  afwas: 'Afwas',
  algemeen: 'Algemeen',
  ziek: 'Ziek',
  verlof: 'Verlof',
  other: 'Overig',
}

function lightenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  const mix = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount))
  const p = (n: number) => n.toString(16).padStart(2, '0')
  return `#${p(mix(r))}${p(mix(g))}${p(mix(b))}`
}

export const STAFF_TEAM_GROUP_COLORS: Record<StaffTeamGroupKey, string> = {
  keuken: STAFF_TEAM_KEUKEN,
  bediening: lightenHex(STAFF_TEAM_KEUKEN, 0.1),
  management: STAFF_TEAM_MANAGEMENT,
  afwas: lightenHex(STAFF_TEAM_KEUKEN, 0.22),
  algemeen: '#8B9BB4',
  ziek: STAFF_TEAM_ZIEK,
  verlof: STAFF_TEAM_VERLOF,
  other: '#9CA3AF',
}

function normalizeTeamName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*&\s*/g, ' & ')
}

/** Map raw Eitje team label → canonical group (merges spelling variants). */
export function staffTeamGroupKey(rawTeamName: string): StaffTeamGroupKey {
  const n = normalizeTeamName(rawTeamName)

  if (/\bkeuken\b/.test(n)) return 'keuken'
  if (/\bbediening\b/.test(n)) return 'bediening'
  if (/\bziek\b/.test(n)) return 'ziek'
  if (/\bvakantie\b/.test(n) || /\bverlof\b/.test(n)) return 'verlof'
  if (/\bafwas\b/.test(n)) return 'afwas'
  if (/\balgemeen\b/.test(n)) return 'algemeen'

  if (
    /\bmanagement\b/.test(n) ||
    /\bhr\b/.test(n) ||
    /\bdaily\b/.test(n) ||
    n === 'weekly' ||
    /\bbestell/.test(n) ||
    /\bstock\b/.test(n)
  ) {
    return 'management'
  }

  return 'other'
}

export function staffTeamGroupLabel(key: StaffTeamGroupKey): string {
  return STAFF_TEAM_GROUP_LABELS[key]
}

export function staffTeamGroupColor(key: StaffTeamGroupKey): string {
  return STAFF_TEAM_GROUP_COLORS[key]
}

export function staffTeamGroupSortIndex(key: StaffTeamGroupKey): number {
  const i = STAFF_TEAM_GROUP_ORDER.indexOf(key)
  return i >= 0 ? i : STAFF_TEAM_GROUP_ORDER.length
}
