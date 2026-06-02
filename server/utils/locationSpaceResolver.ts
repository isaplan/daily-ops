/**
 * @registry-id: locationSpaceResolver
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-30T00:00:00.000Z
 * @description: Resolve Bork table number → location revenue space name from per-location config
 * @last-fix: [2026-05-30] Load revenue_spaces from org/unified location id peers via locationUnifiedIdResolver
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueTablesSection.ts
 * ✓ server/api/locations/[id]/revenue-spaces.get.ts
 * ✓ server/api/daily-ops/snapshot/rebuild-spaces.post.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type { LocationRevenueSpace } from '../../types/location-revenue-spaces'
import { resolveRevenueSpacesLocationIds } from './locationUnifiedIdResolver'
import { defaultRevenueSpacesForLocation } from './locationRevenueSpaceDefaults'
import { getLocationSpaceForTable, LOCATION_SPACE_LABELS } from './dailyOpsRevenue/locationSpaces'

function normalizeSpaces(raw: unknown): LocationRevenueSpace[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const doc = item as Record<string, unknown>
      const id = String(doc.id ?? '').trim()
      const name = String(doc.name ?? '').trim()
      if (!id || !name) return null
      const tableRanges = Array.isArray(doc.tableRanges)
        ? doc.tableRanges
            .map((r) => {
              const range = r as Record<string, unknown>
              const min = Number(range.min)
              const max = Number(range.max)
              if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null
              return { min: Math.trunc(min), max: Math.trunc(max) }
            })
            .filter((r): r is { min: number; max: number } => r != null)
        : []
      const individualTables = Array.isArray(doc.individualTables)
        ? doc.individualTables
            .map((t) => Number(t))
            .filter((t) => Number.isFinite(t) && t > 0)
            .map((t) => Math.trunc(t))
        : []
      return { id, name, tableRanges, individualTables }
    })
    .filter((s): s is LocationRevenueSpace => s != null)
}

export function resolveSpaceNameForTable(
  tableNum: string | number | null | undefined,
  spaces: LocationRevenueSpace[],
): string {
  const n = Number(tableNum)
  if (!Number.isFinite(n) || n <= 0) {
    return spaces.find((s) => s.id === 'overig')?.name ?? 'Overig'
  }
  for (const space of spaces) {
    if (space.id === 'overig') continue
    if (space.individualTables.includes(n)) return space.name
    for (const range of space.tableRanges) {
      if (n >= range.min && n <= range.max) return space.name
    }
  }
  return spaces.find((s) => s.id === 'overig')?.name ?? 'Overig'
}

export function fallbackSpaceNameForTable(tableNum: string | number | null | undefined): string {
  const id = getLocationSpaceForTable(tableNum)
  return LOCATION_SPACE_LABELS[id] ?? 'Overig'
}

export async function loadLocationRevenueSpaces(
  db: Db,
  locationId: string,
  options?: { seedIfEmpty?: boolean; locationName?: string },
): Promise<{ spaces: LocationRevenueSpace[]; seeded: boolean }> {
  if (!ObjectId.isValid(locationId)) {
    return { spaces: [], seeded: false }
  }

  const candidateIds = await resolveRevenueSpacesLocationIds(db, locationId, options?.locationName)
  let locationName = options?.locationName?.trim() ?? ''

  for (const candidateId of candidateIds) {
    const doc = await db.collection('locations').findOne(
      { _id: new ObjectId(candidateId) },
      { projection: { revenue_spaces: 1, name: 1 } },
    )
    if (!locationName && doc?.name) locationName = String(doc.name)
    const spaces = normalizeSpaces(doc?.revenue_spaces)
    if (spaces.length > 0) return { spaces, seeded: false }
  }

  if (!locationName) {
    const doc = await db.collection('locations').findOne(
      { _id: new ObjectId(locationId) },
      { projection: { name: 1 } },
    )
    locationName = String(doc?.name ?? '')
  }

  let defaults: LocationRevenueSpace[] | null = null
  for (const candidateId of candidateIds) {
    defaults = defaultRevenueSpacesForLocation(candidateId, locationName)
    if (defaults?.length) break
  }

  if (options?.seedIfEmpty && defaults?.length) {
    await db.collection('locations').updateOne(
      { _id: new ObjectId(locationId) },
      { $set: { revenue_spaces: defaults, updated_at: new Date() } },
    )
    return { spaces: defaults, seeded: true }
  }
  return { spaces: defaults ?? [], seeded: false }
}

export function parseTableRangeInput(input: string): {
  tableRanges: LocationRevenueSpace['tableRanges']
  individualTables: number[]
} {
  const tableRanges: LocationRevenueSpace['tableRanges'] = []
  const individualTables: number[] = []
  const parts = input
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const min = Number(rangeMatch[1])
      const max = Number(rangeMatch[2])
      if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
        tableRanges.push({ min: Math.trunc(min), max: Math.trunc(max) })
      }
      continue
    }
    const n = Number(part)
    if (Number.isFinite(n) && n > 0) individualTables.push(Math.trunc(n))
  }
  return { tableRanges, individualTables }
}

export function formatTableRangeInput(space: LocationRevenueSpace): string {
  const parts = [
    ...space.tableRanges.map((r) => (r.min === r.max ? String(r.min) : `${r.min}-${r.max}`)),
    ...space.individualTables.map(String),
  ]
  return parts.join(', ')
}

export function slugifySpaceId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'space'
}
