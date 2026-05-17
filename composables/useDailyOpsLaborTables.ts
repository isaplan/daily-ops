/**
 * @created: 2026-05-18T12:00:00.000Z
 * @last-modified: 2026-05-18T12:00:00.000Z
 * @description: Labor-by-day tables, stacked chart, and cell formatters for Daily Ops productivity view.
 * @last-fix: [2026-05-18] Extracted from DailyOpsHomeDashboard.vue labor section.
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsHomeDashboard.vue
 * ✓ components/daily-ops/DailyOpsProductivityLaborSection.vue (future)
 */
import type { Ref } from 'vue'
import type {
  DailyOpsLaborDayDto,
  DailyOpsLaborMetricsDto,
  DailyOpsWorkersTeamLocationDayDto,
} from '~/types/daily-ops-dashboard'
import { formatDayHoursSharePlain, getDayHoursShareParts } from '~/utils/dailyOpsHoursShare'

export const TEAM_DAY_KEY_SEP = ':::'

type LaborDayMetricKey = 'revenue' | 'laborCost' | 'hours' | 'laborPct' | 'eurPerH'
type TeamDayMetricKey = 'staff' | 'hours' | 'cost'

export const laborByDayMetricDefs: { key: LaborDayMetricKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'laborCost', label: 'Labor' },
  { key: 'hours', label: 'Hours' },
  { key: 'laborPct', label: 'Labor % rev.' },
  { key: 'eurPerH', label: '€ / h' },
]

/** Which values the Teams & Workers table columns emphasize (default: labor / revenue % only). */
export type TeamsWorkersTableMetric = 'all' | 'workers' | 'hours' | 'percentage'

export type LaborTeamEntry = {
  teamKey: string
  meta: { locationName: string; teamName: string }
}

export type LaborLocationGroup = {
  locationId: string
  locationName: string
  teams: LaborTeamEntry[]
}

export type LaborByDayTableSegment =
  | { kind: 'location'; loc: LaborLocationGroup }
  | { kind: 'postKinsbergenTotalHours' }

type LaborChartSegmentStyle = { bg: string; fg: string; labelShadow: boolean }

/**
 * Greyscale only: bottom of stack (Afwas: near-black) to top (Ziek: light grey).
 * labelShadow = light text on dark fills for legible % labels.
 */
const LABOR_CHART_KNOWN_SEGMENT_STYLES: Record<string, LaborChartSegmentStyle> = {
  afwas: { bg: '#0a0a0a', fg: '#f5f5f5', labelShadow: true },
  keuken: { bg: '#242424', fg: '#f5f5f5', labelShadow: true },
  bediening: { bg: '#3d3d3d', fg: '#fafafa', labelShadow: true },
  management: { bg: '#575757', fg: '#fafafa', labelShadow: true },
  algemeen: { bg: '#737373', fg: '#ffffff', labelShadow: true },
  ziek: { bg: '#b8b8b8', fg: '#171717', labelShadow: false },
}

/** Ad-hoc teams stack above Ziek: progressively lighter greys, dark labels. */
const LABOR_CHART_OTHER_SEGMENT_STYLES: LaborChartSegmentStyle[] = [
  { bg: '#c9c9c9', fg: '#171717', labelShadow: false },
  { bg: '#d6d6d6', fg: '#171717', labelShadow: false },
  { bg: '#e2e2e2', fg: '#1a1a1a', labelShadow: false },
  { bg: '#ececec', fg: '#1a1a1a', labelShadow: false },
  { bg: '#f2f2f2', fg: '#1c1c1c', labelShadow: false },
  { bg: '#f7f7f7', fg: '#1c1c1c', labelShadow: false },
]

/** Raw name normalize (before aliases / stack mapping). */
const normalizeLaborChartTeamName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ')

/** Bottom → top stack: Afwas … Ziek; then any other teams above Ziek. */
const LABOR_CHART_STACK_DEF = [
  { key: 'afwas', label: 'Afwas' },
  { key: 'keuken', label: 'Keuken' },
  { key: 'bediening', label: 'Bediening' },
  { key: 'management', label: 'Management' },
  { key: 'algemeen', label: 'Algemeen' },
  { key: 'ziek', label: 'Ziek' },
] as const

const LABOR_CHART_STACK_KEY_ORDER = new Map<string, number>(
  LABOR_CHART_STACK_DEF.map((d, i) => [d.key, i])
)

/** These names (normalized) roll up into Management in the chart. */
const LABOR_CHART_MANAGEMENT_ALIAS_NORMS = new Set(
  ['bestellen & stock', 'bestelling & stock', 'hk & hr management'].map((s) =>
    normalizeLaborChartTeamName(s)
  )
)

const laborChartCanonicalTeam = (
  rawName: string
): { stackKey: string; label: string } => {
  const n = normalizeLaborChartTeamName(rawName)
  if (!n) return { stackKey: '_empty', label: rawName.trim() || '—' }
  if (LABOR_CHART_MANAGEMENT_ALIAS_NORMS.has(n)) {
    return { stackKey: 'management', label: 'Management' }
  }
  const known = LABOR_CHART_STACK_DEF.find((d) => d.key === n)
  if (known) return { stackKey: known.key, label: known.label }
  return { stackKey: n, label: rawName.trim() }
}

/** Preferred row order in Labor — By Day (then any other types A–Z, then “none” / `-`). */
const LABOR_CONTRACT_TYPE_ROW_ORDER = ['nul uren', 'uren contract', 'zzp'] as const

export function useDailyOpsLaborTables(labor: Ref<DailyOpsLaborMetricsDto | null>) {
  const { formatEur } = useDashboardEurFormat()

  const laborPctThresholdLow = ref(30)
  const laborPctThresholdHigh = ref(35)

  const teamsWorkersViewMode = ref<'table' | 'chart'>('table')
  const teamsWorkersTableMetric = ref<TeamsWorkersTableMetric>('percentage')

  const laborDayTotalSharePctLabel = (day: DailyOpsLaborDayDto): string => {
    const p = getDayHoursShareParts(day.hours, day)
    return p.pct ?? '—'
  }

  const laborBandBounds = computed(() => {
    const a = Number(laborPctThresholdLow.value)
    const b = Number(laborPctThresholdHigh.value)
    const low = Number.isFinite(a) ? a : 30
    const high = Number.isFinite(b) ? b : 35
    return { lo: Math.min(low, high), hi: Math.max(low, high) }
  })

  const laborPctClass = (pct: number | null): string => {
    if (pct == null || !Number.isFinite(pct)) return 'text-gray-400 font-normal'
    const { lo, hi } = laborBandBounds.value
    if (pct < lo) return 'text-emerald-600 font-semibold'
    if (pct <= hi) return 'text-blue-600 font-semibold'
    return 'text-red-600 font-semibold'
  }

  const formatLaborPctLabel = (pct: number | null): string => {
    if (pct == null || !Number.isFinite(pct)) return '—'
    return `${pct}% / rev.`
  }

  const laborDailyColumnMeta = computed(() => {
    const daily = labor.value?.daily ?? []
    const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })
    const dayMonthFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    return daily.map((row) => {
      const d = new Date(`${row.date}T12:00:00.000Z`)
      return {
        date: row.date,
        weekday: weekdayFmt.format(d),
        dayMonth: dayMonthFmt.format(d),
      }
    })
  })

  /** Pre-aggregated venue × day hours/workers (avoids O(n) scans per table cell). */
  const locationDayRollupMap = computed(() => {
    const m = new Map<string, { hours: number; workers: number }>()
    for (const r of labor.value?.workersByTeamLocationByDay ?? []) {
      const k = `${String(r.locationId)}:::${r.date}`
      let row = m.get(k)
      if (!row) {
        row = { hours: 0, workers: 0 }
        m.set(k, row)
      }
      row.hours += r.totalHours
      row.workers += r.workerCount
    }
    for (const row of m.values()) {
      row.hours = Math.round(row.hours * 10) / 10
    }
    return m
  })

  const getLocationDayRollup = (locationId: string, date: string): { hours: number; workers: number } =>
    locationDayRollupMap.value.get(`${String(locationId)}:::${date}`) ?? { hours: 0, workers: 0 }

  const workersTeamDayMap = computed(() => {
    const flat = labor.value?.workersByTeamLocationByDay ?? []
    const m = new Map<string, DailyOpsWorkersTeamLocationDayDto>()
    for (const r of flat) {
      m.set(`${r.locationId}${TEAM_DAY_KEY_SEP}${r.teamId}${TEAM_DAY_KEY_SEP}${r.date}`, r)
    }
    return m
  })

  const locationRollupShareCell = (locationId: string, day: DailyOpsLaborDayDto): { amount: number; showDash: boolean } => {
    const r = getLocationDayRollup(locationId, day.date)
    return {
      amount: r.hours,
      showDash: r.hours === 0 && r.workers === 0,
    }
  }

  const teamHoursShareCell = (teamKey: string, day: DailyOpsLaborDayDto): { amount: number; showDash: boolean } => {
    const row = workersTeamDayMap.value.get(`${teamKey}${TEAM_DAY_KEY_SEP}${day.date}`)
    if (!row) return { amount: 0, showDash: true }
    return { amount: row.totalHours, showDash: false }
  }

  const contractTypeDayMap = computed(() => {
    const flat = labor.value?.contractTypeByDay ?? []
    const m = new Map<string, { workerCount: number; totalHours: number; totalCost: number }>()
    for (const r of flat) {
      m.set(`${r.contractType}${TEAM_DAY_KEY_SEP}${r.date}`, r)
    }
    return m
  })

  const contractHoursShareCell = (contractType: string, day: DailyOpsLaborDayDto): { amount: number; showDash: boolean } => {
    const row = contractTypeDayMap.value.get(`${contractType}${TEAM_DAY_KEY_SEP}${day.date}`)
    if (!row) return { amount: 0, showDash: true }
    if (row.workerCount === 0 && row.totalHours === 0 && row.totalCost === 0) return { amount: 0, showDash: true }
    return { amount: row.totalHours, showDash: false }
  }

  const formatLaborDayCell = (row: DailyOpsLaborDayDto, key: LaborDayMetricKey): string => {
    switch (key) {
      case 'revenue':
        return formatEur(row.revenue)
      case 'laborCost':
        return formatEur(row.laborCost)
      case 'hours':
        return formatDayHoursSharePlain(row.hours, row)
      case 'laborPct':
        return row.laborCostPctOfRevenue != null ? `${row.laborCostPctOfRevenue.toFixed(1)}%` : '—'
      case 'eurPerH':
        return row.revenuePerLaborHour != null ? formatEur(row.revenuePerLaborHour) : '—'
    }
  }

  const locationLaborPctLookup = computed(() => {
    const m = new Map<string, number | null>()
    for (const r of labor.value?.locationLaborPctByDay ?? []) {
      m.set(`${r.date}|${r.locationId}`, r.laborCostPctOfRevenue ?? null)
    }
    return m
  })

  const locationLaborPct = (locId: string, day: DailyOpsLaborDayDto): number | null =>
    locationLaborPctLookup.value.get(`${day.date}|${String(locId)}`) ?? null

  const teamLaborPct = (teamKey: string, day: DailyOpsLaborDayDto): number | null => {
    const row = workersTeamDayMap.value.get(`${teamKey}${TEAM_DAY_KEY_SEP}${day.date}`)
    return row?.laborCostPctOfRevenue ?? null
  }

  const laborByDayContractTypesSorted = computed(() => {
    const s = new Set<string>()
    for (const r of labor.value?.contractTypeByDay ?? []) s.add(r.contractType)
    const all = [...s]
    const used = new Set<string>()
    const primary: string[] = []
    for (const want of LABOR_CONTRACT_TYPE_ROW_ORDER) {
      const hit = all.find((t) => t.toLowerCase() === want.toLowerCase())
      if (hit != null && !used.has(hit)) {
        primary.push(hit)
        used.add(hit)
      }
    }
    const rest = all
      .filter((t) => t !== '-' && !used.has(t))
      .sort((a, b) => a.localeCompare(b))
    const none = all.includes('-') ? (['-'] as const) : []
    return [...primary, ...rest, ...none]
  })

  const workersTeamKeysSorted = computed(() => {
    const flat = labor.value?.workersByTeamLocationByDay ?? []
    const seen = new Map<string, { locationName: string; teamName: string }>()
    for (const r of flat) {
      const k = `${r.locationId}${TEAM_DAY_KEY_SEP}${r.teamId}`
      if (!seen.has(k)) seen.set(k, { locationName: r.locationName, teamName: r.teamName })
    }
    return [...seen.entries()].sort((a, b) => {
      const la = `${a[1].locationName} ${a[1].teamName}`
      const lb = `${b[1].locationName} ${b[1].teamName}`
      return la.localeCompare(lb)
    })
  })

  const laborTeamsByLocation = computed((): LaborLocationGroup[] => {
    const byLoc = new Map<string, { locationName: string; teams: LaborTeamEntry[] }>()
    for (const [teamKey, meta] of workersTeamKeysSorted.value) {
      const locationId = String(teamKey.split(TEAM_DAY_KEY_SEP)[0] ?? '')
      if (!byLoc.has(locationId)) {
        byLoc.set(locationId, { locationName: meta.locationName, teams: [] })
      }
      byLoc.get(locationId)!.teams.push({ teamKey, meta })
    }
    return [...byLoc.entries()]
      .map(([locationId, v]) => ({
        locationId,
        locationName: v.locationName,
        teams: [...v.teams].sort((a, b) => a.meta.teamName.localeCompare(b.meta.teamName)),
      }))
      .sort((a, b) => a.locationName.localeCompare(b.locationName))
  })

  /** Display label per stackKey (known rows + first seen spelling for ad-hoc teams). */
  const laborChartStackKeyDisplayLabel = computed(() => {
    const m = new Map<string, string>()
    for (const d of LABOR_CHART_STACK_DEF) m.set(d.key, d.label)
    const flat = [...(labor.value?.workersByTeamLocationByDay ?? [])].sort((a, b) => {
      const cmp = normalizeLaborChartTeamName(a.teamName).localeCompare(normalizeLaborChartTeamName(b.teamName))
      if (cmp !== 0) return cmp
      return String(a.teamId).localeCompare(String(b.teamId))
    })
    for (const r of flat) {
      const { stackKey, label } = laborChartCanonicalTeam(r.teamName)
      if (stackKey === '_empty' || m.has(stackKey)) continue
      m.set(stackKey, label)
    }
    return m
  })

  /** Stack keys with hours in the bundle, ordered for palette + legend. */
  const laborChartActiveStackKeysOrdered = computed(() => {
    const active = new Set<string>()
    for (const r of labor.value?.workersByTeamLocationByDay ?? []) {
      if (r.totalHours <= 0) continue
      const { stackKey } = laborChartCanonicalTeam(r.teamName)
      if (stackKey !== '_empty') active.add(stackKey)
    }
    const labels = laborChartStackKeyDisplayLabel.value
    const known = LABOR_CHART_STACK_DEF.map((d) => d.key).filter((k) => active.has(k))
    const unknown = [...active]
      .filter((k) => !LABOR_CHART_STACK_KEY_ORDER.has(k))
      .sort((a, b) => (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b, 'nl', { sensitivity: 'base' }))
    return [...known, ...unknown]
  })

  const laborChartSegmentStylesByStackKey = computed(() => {
    const active = laborChartActiveStackKeysOrdered.value
    const unknowns = active.filter((k) => !LABOR_CHART_KNOWN_SEGMENT_STYLES[k])
    const unknownRank = new Map(unknowns.map((k, i) => [k, i]))
    const m = new Map<string, LaborChartSegmentStyle>()
    for (const k of active) {
      const fixed = LABOR_CHART_KNOWN_SEGMENT_STYLES[k]
      if (fixed) {
        m.set(k, fixed)
        continue
      }
      const r = unknownRank.get(k) ?? 0
      m.set(k, LABOR_CHART_OTHER_SEGMENT_STYLES[r % LABOR_CHART_OTHER_SEGMENT_STYLES.length]!)
    }
    return m
  })

  const formatLaborChartSegPct = (pct: number): string => {
    const p = Math.round(pct * 10) / 10
    if (!Number.isFinite(p) || p <= 0) return '0%'
    if (Math.abs(p - Math.round(p)) < 0.05) return `${Math.round(p)}%`
    return `${p.toFixed(1)}%`
  }

  type LaborStackedChartSeg = {
    stackKey: string
    teamName: string
    hours: number
    color: string
    labelFg: string
    labelShadow: boolean
    pctOfBar: number
  }

  type LaborStackedChartBar = {
    locationId: string
    locationName: string
    totalHours: number
    barHeightPct: number
    segments: LaborStackedChartSeg[]
  }

  type LaborStackedChartCol = {
    date: string
    meta: { weekday: string; dayMonth: string }
    bars: LaborStackedChartBar[]
  }

  const laborStackedChartColumns = computed((): LaborStackedChartCol[] => {
    const daily = labor.value?.daily ?? []
    const locs = laborTeamsByLocation.value
    const stylesMap = laborChartSegmentStylesByStackKey.value
    const tmap = workersTeamDayMap.value
    const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })
    const dayMonthFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

    return daily.map((day) => {
      const bars: LaborStackedChartBar[] = []
      for (const loc of locs) {
        const segAcc = new Map<string, { hours: number; label: string }>()
        for (const { teamKey, meta } of loc.teams) {
          const row = tmap.get(`${teamKey}${TEAM_DAY_KEY_SEP}${day.date}`)
          const h = row?.totalHours ?? 0
          if (h <= 0) continue
          const { stackKey, label } = laborChartCanonicalTeam(meta.teamName)
          if (stackKey === '_empty') continue
          const prev = segAcc.get(stackKey)
          if (prev) prev.hours += h
          else segAcc.set(stackKey, { hours: h, label })
        }
        const unknownKeys = [...segAcc.keys()]
          .filter((k) => !LABOR_CHART_STACK_KEY_ORDER.has(k))
          .sort((a, b) => a.localeCompare(b, 'nl'))
        const unknownIdx = new Map(unknownKeys.map((k, i) => [k, i]))
        const rawTotalH = [...segAcc.values()].reduce((s, v) => s + v.hours, 0)
        const segments: LaborStackedChartSeg[] = [...segAcc.entries()]
          .map(([stackKey, v]) => {
            const st = stylesMap.get(stackKey) ?? {
              bg: '#a3a3a3',
              fg: '#171717',
              labelShadow: false,
            }
            const pct = rawTotalH > 0 ? (v.hours / rawTotalH) * 100 : 0
            return {
              stackKey,
              teamName: v.label,
              hours: Math.round(v.hours * 10) / 10,
              color: st.bg,
              labelFg: st.fg,
              labelShadow: st.labelShadow,
              pctOfBar: Math.round(pct * 10) / 10,
            }
          })
          .sort((a, b) => {
            const ia = LABOR_CHART_STACK_KEY_ORDER.get(a.stackKey)
            const ib = LABOR_CHART_STACK_KEY_ORDER.get(b.stackKey)
            if (ia != null && ib != null) return ia - ib
            if (ia != null) return -1
            if (ib != null) return 1
            return (unknownIdx.get(a.stackKey) ?? 0) - (unknownIdx.get(b.stackKey) ?? 0)
          })
          /* flex-col + justify-end: last DOM node sits on the baseline = bottom of bar → darkest (Afwas) must be last */
          .reverse()
        const roundedTotal = Math.round(segments.reduce((s, x) => s + x.hours, 0) * 10) / 10
        bars.push({
          locationId: loc.locationId,
          locationName: loc.locationName,
          totalHours: roundedTotal,
          barHeightPct: 0,
          segments,
        })
      }
      const dayMax = Math.max(0, ...bars.map((b) => b.totalHours))
      for (const b of bars) {
        b.barHeightPct = dayMax > 0 ? (b.totalHours / dayMax) * 100 : 0
      }
      const d = new Date(`${day.date}T12:00:00.000Z`)
      return {
        date: day.date,
        meta: { weekday: weekdayFmt.format(d), dayMonth: dayMonthFmt.format(d) },
        bars,
      }
    })
  })

  const laborStackedChartLegend = computed(() => {
    const styles = laborChartSegmentStylesByStackKey.value
    const labels = laborChartStackKeyDisplayLabel.value
    const out: { normKey: string; label: string; color: string }[] = []
    for (const stackKey of laborChartActiveStackKeysOrdered.value) {
      const st = styles.get(stackKey) ?? { bg: '#a3a3a3', fg: '#171717', labelShadow: false }
      out.push({
        normKey: stackKey,
        label: labels.get(stackKey) ?? stackKey,
        color: st.bg,
      })
    }
    return out
  })

  const isVanKinsbergenVenue = (loc: LaborLocationGroup): boolean =>
    loc.locationName.toLowerCase().includes('kinsbergen')

  /** Location tbodys plus an extra totals row immediately after Van Kinsbergen. */
  const laborByDayLocationSegments = computed((): LaborByDayTableSegment[] => {
    const out: LaborByDayTableSegment[] = []
    for (const loc of laborTeamsByLocation.value) {
      out.push({ kind: 'location', loc })
      if (isVanKinsbergenVenue(loc)) {
        out.push({ kind: 'postKinsbergenTotalHours' })
      }
    }
    return out
  })

  /** Expanded/collapsed per venue (Map + shallowRef so toggles always trigger updates). */
  const laborLocationExpandedMap = shallowRef(new Map<string, boolean>())

  const isLaborLocationExpanded = (locationId: string): boolean => {
    const id = String(locationId)
    const m = laborLocationExpandedMap.value
    if (!m.has(id)) return false
    return m.get(id) === true
  }

  const toggleLaborLocationExpanded = (locationId: string): void => {
    const id = String(locationId)
    const prev = laborLocationExpandedMap.value
    const nextMap = new Map(prev)
    const expanded = isLaborLocationExpanded(id)
    nextMap.set(id, !expanded)
    laborLocationExpandedMap.value = nextMap
  }

  const laborTeamsVisibleForLocation = (loc: LaborLocationGroup): LaborTeamEntry[] =>
    isLaborLocationExpanded(loc.locationId) ? loc.teams : []

  const formatLocationRollupWorkersLine = (locationId: string, date: string): string => {
    const { hours, workers } = getLocationDayRollup(locationId, date)
    if (hours === 0 && workers === 0) return '—'
    return `${workers} workers`
  }

  const workersTeamPivotRows = computed(() => {
    const out: { teamKey: string; label: string; metric: TeamDayMetricKey }[] = []
    for (const [teamKey, meta] of workersTeamKeysSorted.value) {
      const base = `${meta.locationName} · ${meta.teamName}`
      out.push({ teamKey, label: `${base} · Staff`, metric: 'staff' })
      out.push({ teamKey, label: `${base} · Hours`, metric: 'hours' })
      out.push({ teamKey, label: `${base} · Cost`, metric: 'cost' })
    }
    return out
  })

  const formatTeamDayCell = (teamKey: string, date: string, metric: TeamDayMetricKey): string => {
    const row = workersTeamDayMap.value.get(`${teamKey}${TEAM_DAY_KEY_SEP}${date}`)
    if (!row) return '—'
    switch (metric) {
      case 'staff':
        return String(row.workerCount)
      case 'hours':
        return row.totalHours.toFixed(1)
      case 'cost':
        return formatEur(row.totalCost)
    }
  }

  const formatTeamNameBelowHours = (
    teamKey: string,
    date: string,
    meta: { locationName: string; teamName: string }
  ): string => {
    const row = workersTeamDayMap.value.get(`${teamKey}${TEAM_DAY_KEY_SEP}${date}`)
    if (!row) return '—'
    if (row.workerCount === 0 && row.totalHours === 0) return '—'
    return `${row.workerCount} · ${meta.teamName}`
  }

  const formatContractBelowHoursLine = (contractType: string, date: string): string => {
    const row = contractTypeDayMap.value.get(`${contractType}${TEAM_DAY_KEY_SEP}${date}`)
    if (!row) return '—'
    if (row.workerCount === 0 && row.totalHours === 0 && row.totalCost === 0) return '—'
    return `${row.workerCount} staff · ${formatEur(row.totalCost)}`
  }

  return {
    laborPctThresholdLow,
    laborPctThresholdHigh,
    teamsWorkersViewMode,
    teamsWorkersTableMetric,
    laborDayTotalSharePctLabel,
    laborPctClass,
    formatLaborPctLabel,
    laborDailyColumnMeta,
    locationRollupShareCell,
    teamHoursShareCell,
    contractHoursShareCell,
    formatLaborDayCell,
    locationLaborPct,
    teamLaborPct,
    laborByDayContractTypesSorted,
    laborTeamsByLocation,
    formatLaborChartSegPct,
    laborStackedChartColumns,
    laborStackedChartLegend,
    laborByDayLocationSegments,
    isLaborLocationExpanded,
    toggleLaborLocationExpanded,
    laborTeamsVisibleForLocation,
    formatLocationRollupWorkersLine,
    workersTeamPivotRows,
    formatTeamDayCell,
    formatTeamNameBelowHours,
    formatContractBelowHoursLine,
  }
}
