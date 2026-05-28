/**
 * @registry-id: dailyOpsLocationChartColors
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Location chart colors SSOT — read from unified_location.chartColor with abbreviation fallbacks.
 * @last-fix: [2026-05-28] Persist venue graph colors on unified_location; API + charts reference DB field.
 *
 * @exports-to:
 * ✓ server/api/daily-ops/locations.get.ts
 * ✓ composables/useDailyOpsLocationChartColors.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsLocationRowDto } from '~/types/daily-ops-locations'

/** Seed / fallback when unified_location.chartColor is missing (abbreviation match). */
export const DAILY_OPS_DEFAULT_LOCATION_CHART_COLORS: Record<string, string> = {
  VKB: '#0891B2',
  BEA: '#D4AF37',
  LAT: '#EF4444',
}

const CHART_COLOR_HEX = /^#[0-9A-Fa-f]{6}$/

export function normalizeChartColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return CHART_COLOR_HEX.test(trimmed) ? trimmed.toUpperCase() : null
}

function abbreviationForDoc(doc: Record<string, unknown>): string {
  const abbrev = typeof doc.abbreviation === 'string' ? doc.abbreviation.trim().toUpperCase() : ''
  if (abbrev) return abbrev
  const name = String(doc.name ?? doc.primaryName ?? doc.canonicalName ?? '').toLowerCase()
  if (/kinsbergen/.test(name)) return 'VKB'
  if ((name.includes('bar') && name.includes('bea')) || name.replace(/\s+/g, '') === 'barbea') return 'BEA'
  if (/amour/.test(name) && /toujours/.test(name)) return 'LAT'
  return ''
}

export function fallbackChartColorForAbbreviation(abbreviation: string): string | null {
  const key = abbreviation.trim().toUpperCase()
  return DAILY_OPS_DEFAULT_LOCATION_CHART_COLORS[key] ?? null
}

export function resolveChartColorFromUnifiedLocationDoc(doc: Record<string, unknown>): string {
  const stored = normalizeChartColor(doc.chartColor)
  if (stored) return stored
  const fallback = fallbackChartColorForAbbreviation(abbreviationForDoc(doc))
  return fallback ?? '#111827'
}

export function mapUnifiedLocationToDailyOpsRow(doc: Record<string, unknown>): DailyOpsLocationRowDto {
  const abbreviation = abbreviationForDoc(doc)
  return {
    _id: String(doc._id),
    name: String(doc.name ?? doc.primaryName ?? doc.canonicalName ?? ''),
    abbreviation,
    eitjeId: Array.isArray(doc.eitjeIds) ? doc.eitjeIds[0] : undefined,
    chartColor: resolveChartColorFromUnifiedLocationDoc(doc),
  }
}

export async function fetchDailyOpsLocationRows(db: Db): Promise<DailyOpsLocationRowDto[]> {
  const docs = await db.collection('unified_location').find({}).sort({ name: 1 }).toArray()
  return docs.map((doc) => mapUnifiedLocationToDailyOpsRow(doc as Record<string, unknown>))
}

export async function fetchLocationChartColorMap(db: Db): Promise<Record<string, string>> {
  const rows = await fetchDailyOpsLocationRows(db)
  return Object.fromEntries(rows.map((row) => [row._id, row.chartColor]))
}

export function chartColorForLocationId(
  locationId: string,
  colorMap: Record<string, string>,
): string {
  return colorMap[locationId] ?? '#111827'
}

/** Seed values written to unified_location.chartColor (run scripts/seed-location-chart-colors.ts). */
export const DAILY_OPS_LOCATION_CHART_COLOR_SEED: Record<string, string> = {
  ...DAILY_OPS_DEFAULT_LOCATION_CHART_COLORS,
}
