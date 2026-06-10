/**
 * @registry-id: dailyOpsVenueStripMergeCards
 * @created: 2026-06-10T00:00:00.000Z
 * @last-modified: 2026-06-10T00:00:00.000Z
 * @description: Merge single-day venue strip cards into period rollups
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueStrip.ts
 */

import type {
  VenueStripCardDto,
  VenueStripContractRowDto,
  VenueStripLaborRowDto,
  VenueStripResponseDto,
} from '~/types/daily-ops-dashboard'
import { VENUE_STRIP_LOCATIONS } from './constants'
import { enrichLaborWithPct, productivityPerHour } from './labor'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function mergeLaborRow(a: VenueStripLaborRowDto, b: VenueStripLaborRowDto): VenueStripLaborRowDto {
  return {
    workers: a.workers + b.workers,
    hours: round2(a.hours + b.hours),
    wages: round2(a.wages + b.wages),
    loaded: round2(a.loaded + b.loaded),
    laborPctOfRevenue: null,
  }
}

function mergeLaborBlock(
  a: VenueStripCardDto['labor'],
  b: VenueStripCardDto['labor'],
): VenueStripCardDto['labor'] {
  return {
    all: mergeLaborRow(a.all, b.all),
    gewerkt: mergeLaborRow(a.gewerkt, b.gewerkt),
    keuken: mergeLaborRow(a.keuken, b.keuken),
    bediening: mergeLaborRow(a.bediening, b.bediening),
    other: mergeLaborRow(a.other, b.other),
  }
}

function mergeContractRows(rows: VenueStripContractRowDto[]): VenueStripContractRowDto[] {
  const byType = new Map<string, VenueStripContractRowDto>()
  for (const row of rows) {
    const existing = byType.get(row.contractType)
    if (!existing) {
      byType.set(row.contractType, { ...row })
      continue
    }
    existing.workers += row.workers
    existing.hours = round2(existing.hours + row.hours)
    existing.wages = round2(existing.wages + row.wages)
    existing.loaded = round2(existing.loaded + row.loaded)
  }
  return Array.from(byType.values())
}

function mergeContracts(
  a: VenueStripCardDto['contractsByTeam'],
  b: VenueStripCardDto['contractsByTeam'],
): VenueStripCardDto['contractsByTeam'] {
  return {
    keuken: mergeContractRows([...a.keuken, ...b.keuken]),
    bediening: mergeContractRows([...a.bediening, ...b.bediening]),
    other: mergeContractRows([...a.other, ...b.other]),
  }
}

/** Sum daily venue cards into one period rollup card. */
export function mergeVenueStripCards(cards: VenueStripCardDto[]): VenueStripCardDto {
  if (cards.length === 0) {
    throw new Error('mergeVenueStripCards: empty input')
  }

  let merged: VenueStripCardDto = { ...cards[0]! }

  for (let i = 1; i < cards.length; i++) {
    const c = cards[i]!
    merged = {
      ...merged,
      revenue: {
        total: round2(merged.revenue.total + c.revenue.total),
        food: round2(merged.revenue.food + c.revenue.food),
        beverage: round2(merged.revenue.beverage + c.revenue.beverage),
        totalIncVat: round2(merged.revenue.totalIncVat + c.revenue.totalIncVat),
        foodIncVat: round2(merged.revenue.foodIncVat + c.revenue.foodIncVat),
        beverageIncVat: round2(merged.revenue.beverageIncVat + c.revenue.beverageIncVat),
      },
      labor: mergeLaborBlock(merged.labor, c.labor),
      contractsByTeam: mergeContracts(merged.contractsByTeam, c.contractsByTeam),
      coverage: {
        hasRevenue: merged.coverage.hasRevenue || c.coverage.hasRevenue,
        hasLabor: merged.coverage.hasLabor || c.coverage.hasLabor,
        snapshotBuilt: merged.coverage.snapshotBuilt || c.coverage.snapshotBuilt,
      },
    }
  }

  const headlineTotal = merged.revenue.total
  merged.labor = enrichLaborWithPct(merged.labor, headlineTotal)
  merged.productivity = {
    totalPerHour: productivityPerHour(headlineTotal, merged.labor.gewerkt.hours),
    keukenPerHour: productivityPerHour(merged.revenue.food, merged.labor.keuken.hours),
    bedieningPerHour: productivityPerHour(merged.revenue.beverage, merged.labor.bediening.hours),
  }
  merged.workers = []
  merged.active = { workers: 0, rows: [] }

  return merged
}

/** Merge daily/monthly cached venue strips into one period response. */
export function mergeVenueStripResponses(
  strips: VenueStripResponseDto[],
  range: { period: string; startDate: string; endDate: string },
): VenueStripResponseDto {
  const cardsByLoc = new Map<string, VenueStripCardDto[]>()
  for (const strip of strips) {
    for (const card of strip.venues) {
      const list = cardsByLoc.get(card.locationId) ?? []
      list.push(card)
      cardsByLoc.set(card.locationId, list)
    }
  }

  const emptyRow = (): VenueStripLaborRowDto => ({
    workers: 0,
    hours: 0,
    wages: 0,
    loaded: 0,
    laborPctOfRevenue: null,
  })

  const venues = VENUE_STRIP_LOCATIONS.map((venue) => {
    const dailyCards = cardsByLoc.get(venue.locationId) ?? []
    if (dailyCards.length === 0) {
      const row = emptyRow()
      return {
        locationId: venue.locationId,
        locationName: venue.locationName,
        revenue: { total: 0, food: 0, beverage: 0, totalIncVat: 0, foodIncVat: 0, beverageIncVat: 0 },
        labor: { all: row, gewerkt: row, keuken: row, bediening: row, other: row },
        workers: [],
        active: { workers: 0, rows: [] },
        productivity: { totalPerHour: null, keukenPerHour: null, bedieningPerHour: null },
        contractsByTeam: { keuken: [], bediening: [], other: [] },
        coverage: { hasRevenue: false, hasLabor: false, snapshotBuilt: false },
      }
    }
    if (dailyCards.length === 1) return dailyCards[0]!
    return mergeVenueStripCards(dailyCards)
  })

  return { range, venues }
}
