/**
 * @description: Operational labor rollups (gewerkte uren, Afwas 50/50) for venue KPIs.
 * Consumes eitje_time_registration_aggregation or daily_ops_snapshot_section_labor — never raw.
 */

export type VenueLaborSlice = { hours: number; wages: number; loaded: number }

export function isOperationalTeamName (teamName: string): boolean {
  const n = (teamName ?? '').trim().toLowerCase()
  return n === 'keuken' || n === 'bediening' || n === 'afwas'
}

/** True when agg rows predate gewerkt_* fields (total_hours only). */
export function aggRowsUseLegacyGewerktSchema (rows: Array<Record<string, unknown>>): boolean {
  if (rows.length === 0) return false
  return !rows.some((r) => typeof r.gewerkt_hours === 'number')
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
