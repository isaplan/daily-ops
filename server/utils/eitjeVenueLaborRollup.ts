/**
 * @description: Operational labor rollups (gewerkte uren, Afwas 50/50) for venue KPIs.
 * Consumes eitje_time_registration_aggregation or daily_ops_snapshot_section_labor — never raw.
 * @last-fix: [2026-05-26] Treat all-zero gewerkt_* rows as legacy/incomplete and fall back to operational total_hours.
 */

export type VenueLaborSlice = { hours: number; wages: number; loaded: number }

export function isOperationalTeamName (teamName: string): boolean {
  const n = (teamName ?? '').trim().toLowerCase()
  return n === 'keuken' || n === 'bediening' || n === 'afwas'
}

/** True when agg rows have no usable positive gewerkt_* values; operational teams use total_* as gewerkt proxy. */
export function aggRowsUseLegacyGewerktSchema (rows: Array<Record<string, unknown>>): boolean {
  if (rows.length === 0) return false
  const operationalRows = rows.filter((r) => isOperationalTeamName(String(r.team_name ?? '')))
  if (operationalRows.some((r) => Number(r.gewerkt_hours ?? 0) > 0)) return false
  return operationalRows.some((r) => Number(r.total_hours ?? 0) > 0)
}

/**
 * Gewerkte slice for one agg row. Legacy rows: operational teams use total_* as gewerkt proxy.
 */
export function resolveRowGewerktSlice (
  r: Record<string, unknown>,
  legacyGewerkt: boolean
): VenueLaborSlice | null {
  const team = String(r.team_name ?? '')
  if (!legacyGewerkt) {
    const gewHours = Number(r.gewerkt_hours ?? 0)
    if (gewHours <= 0) return null
    return {
      hours: gewHours,
      wages: Number(r.gewerkt_cost ?? 0),
      loaded: Number(r.gewerkt_cost_loaded ?? 0),
    }
  }
  if (!isOperationalTeamName(team)) return null
  const hours = Number(r.total_hours ?? 0)
  if (hours <= 0) return null
  return {
    hours,
    wages: Number(r.total_cost ?? 0),
    loaded: Number(r.total_cost_loaded ?? 0),
  }
}

export type VenueOperationalLabor = {
  keuken: VenueLaborSlice
  bediening: VenueLaborSlice
}

function emptySlice (): VenueLaborSlice {
  return { hours: 0, wages: 0, loaded: 0 }
}

/** Afwas → 50/50 Keuken/Bediening; other non-op teams excluded from gewerkte ops split. */
export function allocateOperationalTeamLabor (
  teamName: string,
  slice: VenueLaborSlice
): VenueOperationalLabor {
  const n = (teamName ?? '').trim().toLowerCase()
  if (n === 'keuken') return { keuken: slice, bediening: emptySlice() }
  if (n === 'bediening') return { keuken: emptySlice(), bediening: slice }
  if (n === 'afwas') {
    const half: VenueLaborSlice = {
      hours: slice.hours / 2,
      wages: slice.wages / 2,
      loaded: slice.loaded / 2,
    }
    return { keuken: half, bediening: half }
  }
  return { keuken: emptySlice(), bediening: emptySlice() }
}

function addSlice (target: VenueLaborSlice, source: VenueLaborSlice): void {
  target.hours += source.hours
  target.wages += source.wages
  target.loaded += source.loaded
}

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function sliceToLaborCostPair (slice: VenueLaborSlice, record_count: number): {
  hours: number
  wage_cost: number
  loaded_cost: number
  record_count: number
} {
  return {
    hours: round2(slice.hours),
    wage_cost: round2(slice.wages),
    loaded_cost: round2(slice.loaded),
    record_count,
  }
}

/** Operational gewerkt rollups for daily_ops_snapshot_section_labor (ADR-004 write path). */
export function rollupOperationalLaborForSnapshot (
  rows: Array<Record<string, unknown>>,
): {
  operational: {
    gewerkt: { hours: number; wage_cost: number; loaded_cost: number; record_count: number }
    keuken: { hours: number; wage_cost: number; loaded_cost: number; record_count: number }
    bediening: { hours: number; wage_cost: number; loaded_cost: number; record_count: number }
  }
  totals_gewerkt: { hours: number; wage_cost: number; loaded_cost: number; record_count: number }
} | null {
  if (rows.length === 0) return null

  const legacyGewerkt = aggRowsUseLegacyGewerktSchema(rows)
  const keuken = emptySlice()
  const bediening = emptySlice()
  let gewerktRows = 0

  for (const r of rows) {
    const gewSlice = resolveRowGewerktSlice(r, legacyGewerkt)
    if (!gewSlice) continue
    gewerktRows += 1
    const alloc = allocateOperationalTeamLabor(String(r.team_name ?? ''), gewSlice)
    addSlice(keuken, alloc.keuken)
    addSlice(bediening, alloc.bediening)
  }

  const gewHours = keuken.hours + bediening.hours
  if (gewHours <= 0) return null

  const gewerkt = sliceToLaborCostPair(
    { hours: gewHours, wages: keuken.wages + bediening.wages, loaded: keuken.loaded + bediening.loaded },
    gewerktRows,
  )

  return {
    operational: {
      gewerkt,
      keuken: sliceToLaborCostPair(keuken, gewerktRows),
      bediening: sliceToLaborCostPair(bediening, gewerktRows),
    },
    totals_gewerkt: gewerkt,
  }
}

export function rollupOperationalKeukenBediening (
  teamRows: Array<{ teamName: string; hours: number; wages: number; loaded: number }>
): VenueOperationalLabor {
  const out: VenueOperationalLabor = { keuken: emptySlice(), bediening: emptySlice() }
  for (const row of teamRows) {
    const slice: VenueLaborSlice = {
      hours: Number(row.hours ?? 0),
      wages: Number(row.wages ?? 0),
      loaded: Number(row.loaded ?? 0),
    }
    const alloc = allocateOperationalTeamLabor(String(row.teamName ?? ''), slice)
    addSlice(out.keuken, alloc.keuken)
    addSlice(out.bediening, alloc.bediening)
  }
  return out
}
