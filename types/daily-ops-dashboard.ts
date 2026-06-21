export const DAILY_OPS_DAY_PERIOD_IDS = [
  'today',
  'yesterday',
  'd2',
  'd3',
  'd4',
  'd5',
  'd6',
  'd7',
] as const

/** Week/month/year rollups (Daily Ops overview range nav only). */
export const DAILY_OPS_RANGE_PERIOD_IDS = [
  'this-week',
  'last-week',
  'this-month',
  'last-month',
  'this-year',
  'last-year',
] as const

export const DAILY_OPS_PERIOD_IDS = [
  ...DAILY_OPS_DAY_PERIOD_IDS,
  ...DAILY_OPS_RANGE_PERIOD_IDS,
] as const

/** Rolling single-day periods (offsets 2–7 from anchor). */
export const DAILY_OPS_ROLLING_DAY_PERIOD_IDS = ['d2', 'd3', 'd4', 'd5', 'd6', 'd7'] as const

export type DailyOpsPeriodId = (typeof DAILY_OPS_PERIOD_IDS)[number]

export type DailyOpsRangeDto = {
  period: string
  startDate: string
  endDate: string
}

export type DailyOpsLaborBreakdownTeam = {
  key: 'keuken' | 'bediening' | 'other'
  label: string
  wages: number
  loaded: number
  hours: number
}

/**
 * Snapshot-sourced labor breakdown (Phase A.1 wire-in, 2026-05-13).
 * Augments totalLaborCost with wage vs loaded cost methodologies + per-team rollup
 * (Keuken / Bediening / Other). Read from daily_ops_snapshot_section_labor.
 */
export type DailyOpsLaborBreakdownDto = {
  wages: number
  loaded: number
  hours: number
  byTeam: DailyOpsLaborBreakdownTeam[]
  coverage: {
    daysFound: number
    daysExpected: number
    locationsFound: number
  }
}

/** Multi-day ranges: which business_dates have snapshot rows in the requested period. */
export type DailyOpsSnapshotCoverageDto = {
  daysExpected: number
  daysFound: number
  missingDates: string[]
}

export type DailyOpsSummaryDto = {
  range: DailyOpsRangeDto
  /** Present when period spans multiple days or a day snapshot is missing. */
  snapshotCoverage?: DailyOpsSnapshotCoverageDto
  summary: {
    totalRevenue: number
    totalLaborCost: number
    totalLaborHours: number
    profit: number
    profitMarginPct: number
    /** Revenue per worked hour (€/h) when hours > 0 */
    revenuePerLaborHour: number | null
    /** Labor cost as % of revenue when revenue > 0 */
    laborCostPctOfRevenue: number | null
    /** Which number drives headline + profit / €·h / labor % (single completed days: inbox Basis when present) */
    revenueLeadSource?: 'inbox_basis_ex_vat' | 'bork_api_merged'
    /** Bork API + Inbox Basis totals for the period */
    revenueSources?: {
      apiBusinessDaysTotal: number
      inboxBasisExVat: number | null
    }
    /** Snapshot-sourced labor cost breakdown (wages vs loaded, per team). Optional. */
    laborBreakdown?: DailyOpsLaborBreakdownDto
  }
  vatDisclaimer: string
}

export type DailyOpsProfitHourDto = {
  hourLabel: string
  date: string
  hour: number
  revenue: number
  laborCost: number
  cogsCost: number
  fixedCost: number
  profit: number
  estimatesNote: string
}

export type DailyOpsProfitIntervalKey = 'lunch' | 'afternoon' | 'dinner' | 'late_night'

export type DailyOpsProfitIntervalCellDto = {
  date: string
  locationId: string | null
  locationName: string
  intervalKey: DailyOpsProfitIntervalKey
  intervalLabel: string
  revenue: number
  laborCost: number
  cogsCost: number
  fixedCost: number
  profit: number
  /** Full-day loaded labor for this venue+date (matches venue strip); interval labor is a revenue share. */
  dayLoadedLabor: number
  chartColor: string
}

export type DailyOpsProfitByIntervalDto = {
  estimatesNote: string
  dates: string[]
  cells: DailyOpsProfitIntervalCellDto[]
  /** Human-readable gap note when period is partial (missing snapshot days). */
  coverageNote?: string | null
}

export type DailyOpsHourlyRevenueLocationDto = {
  locationId: string
  locationName: string
  revenue: number
  laborHours: number
  revenuePerLaborHour: number | null
}

export type DailyOpsHourlyRevenueRowDto = {
  calendarHour: number
  revenue: number
  laborHours: number
  revenuePerLaborHour: number | null
  locations: DailyOpsHourlyRevenueLocationDto[]
}

export type DailyOpsRevenueDrilldownStatus = 'above' | 'below' | 'neutral'

export type DailyOpsRevenueDrilldownLocationHourDto = {
  locationId: string
  locationName: string
  revenue: number
  laborCost: number
  profit: number
}

export type DailyOpsRevenueDrilldownHourlyRowDto = {
  calendarHour: number
  hourLabel: string
  revenue: number
  laborCost: number
  cogsCost: number
  fixedCost: number
  profit: number
  benchmarkRevenue: number | null
  benchmarkDelta: number | null
  benchmarkStatus: DailyOpsRevenueDrilldownStatus
  locations: DailyOpsRevenueDrilldownLocationHourDto[]
}

export type DailyOpsRevenueDrilldownSpaceRowDto = {
  locationId: string
  locationName: string
  spaceName: string
  revenue: number
  quantity: number
  pctOfVenueRevenue: number | null
}

export type DailyOpsRevenueDrilldownTopRowDto = {
  label: string
  subLabel?: string
  revenue: number
  quantity: number
  count?: number
}

export type DailyOpsRevenueDrilldownTop10WorkersDto = {
  paymentTime: DailyOpsRevenueDrilldownTopRowDto[]
  orderTime: DailyOpsRevenueDrilldownTopRowDto[]
}

export type DailyOpsRevenueDrilldownDto = {
  estimatesNote: string
  /** True when period spans more than one calendar day (hourly totals are summed). */
  multiDayRange?: boolean
  coverageNotes: string[]
  hourlyRows: DailyOpsRevenueDrilldownHourlyRowDto[]
  spaces: DailyOpsRevenueDrilldownSpaceRowDto[]
  top10: {
    workers: DailyOpsRevenueDrilldownTop10WorkersDto
    tables: DailyOpsRevenueDrilldownTopRowDto[]
    foodProducts: DailyOpsRevenueDrilldownTopRowDto[]
    beverageProductsOrCategories: DailyOpsRevenueDrilldownTopRowDto[]
  }
}

export type DailyOpsRevenueBreakdownDto = {
  range: DailyOpsRangeDto
  revenueByCategory: { key: string; label: string; amount: number }[]
  revenueByTimePeriod: { key: string; label: string; amount: number }[]
  mostProfitableHour: DailyOpsProfitHourDto
  profitByInterval: DailyOpsProfitByIntervalDto
  drilldown?: DailyOpsRevenueDrilldownDto
  /** When period is `today`: hourly API totals by calendar hour + inbox Basis Report rows at 15:00 / 23:00 (cron_hour) */
  todayRevenueDetail?: {
    apiHourlyByCalendarHour: DailyOpsHourlyRevenueRowDto[]
    orderHourlyByCalendarHour?: DailyOpsHourlyRevenueRowDto[]
    inboxBasisCronSnapshots: { cronHour: number; finalRevenueExVat: number; locationLabel: string }[]
  }
}

export type DailyOpsTodayRevenueDetailDto = NonNullable<DailyOpsRevenueBreakdownDto['todayRevenueDetail']>

export type DailyOpsLaborDayDto = {
  date: string
  revenue: number
  laborCost: number
  hours: number
  /** Distinct Eitje users with time rows that day (UTC period). */
  distinctWorkerCount: number
  laborCostPctOfRevenue: number | null
  revenuePerLaborHour: number | null
}

export type DailyOpsWorkersTeamLocationDayDto = {
  date: string
  locationId: string
  locationName: string
  teamId: string
  teamName: string
  workerCount: number
  totalHours: number
  totalCost: number
  /** Labor cost as % of revenue attributed to this team (venue revenue x team hours share). */
  laborCostPctOfRevenue: number | null
}

export type DailyOpsContractTypeDayDto = {
  date: string
  contractType: string
  workerCount: number
  totalHours: number
  totalCost: number
}

/** One staff member × day × location × team (from eitje_time_registration_aggregation). */
export type DailyOpsWorkerStaffDetailDto = {
  date: string
  locationId: string
  locationName: string
  teamId: string
  teamName: string
  userId: string
  staffName: string
  contractType: string
  totalHours: number
  totalCost: number
  laborCostPctOfRevenue: number | null
}

export type DailyOpsWorkerStaffDetailResponseDto = {
  workerStaffDetail: DailyOpsWorkerStaffDetailDto[]
}

export type DailyOpsLaborMetricsDto = {
  range: DailyOpsRangeDto
  inventory: {
    hasBorkCronData: boolean
    hasBorkHourData: boolean
    hasEitjeAggData: boolean
    notes: string[]
  }
  workersByTeamLocation: {
    locationId: string
    locationName: string
    teamId: string
    teamName: string
    workerCount: number
    totalHours: number
    totalCost: number
  }[]
  /** Per-day rows for transposed workers × team table */
  workersByTeamLocationByDay: DailyOpsWorkersTeamLocationDayDto[]
  /** Venue labor cost as % of Bork revenue for that venue and UTC day. */
  locationLaborPctByDay: {
    date: string
    locationId: string
    laborCostPctOfRevenue: number | null
  }[]
  /** Bork revenue (ex VAT) per venue per UTC day — for drawer % Rev fallbacks. */
  revenueByLocationDay: {
    date: string
    locationId: string
    revenue: number
  }[]
  hoursCostByContractType: {
    contractType: string
    totalHours: number
    totalCost: number
  }[]
  /** Per UTC day and contract type (from members). */
  contractTypeByDay: DailyOpsContractTypeDayDto[]
  daily: DailyOpsLaborDayDto[]
  periodRollup: {
    revenue: number
    laborCost: number
    hours: number
    laborCostPctOfRevenue: number | null
    revenuePerLaborHour: number | null
  }
  productivityByLocationDay: {
    locationId: string
    locationName: string
    highest: {
      date: string
      revenuePerLaborHour: number
      revenue: number
      hours: number
    } | null
    lowest: {
      date: string
      revenuePerLaborHour: number
      revenue: number
      hours: number
    } | null
  }[]
}

export type DailyOpsOverviewDto = {
  range: DailyOpsRangeDto
  summary: {
    totalRevenue: number
    totalLaborCost: number
    profit: number
    profitMarginPct: number
  }
  revenueByCategory: { key: string; label: string; amount: number }[]
  revenueByTimePeriod: { key: string; label: string; amount: number }[]
  mostProfitableHour: DailyOpsProfitHourDto
  vatDisclaimer: string
}

export type DailyOpsSectionStubDto = {
  range: DailyOpsRangeDto
  section: string
  title: string
  message: string
}

export type VenueStripTeamBucket = 'keuken' | 'bediening' | 'other'

export type VenueStripLaborRowDto = {
  workers: number
  hours: number
  wages: number
  loaded: number
  /** Loaded labor cost as % of venue revenue (filled server-side). */
  laborPctOfRevenue: number | null
}

export type VenueStripContractRowDto = {
  contractType: string
  workers: number
  hours: number
  wages: number
  loaded: number
}

/** Clocked-in staff with no end time on the open register business day. */
export type VenueStripActiveWorkerRowDto = {
  userId: string
  userName: string
  teamName: string
  /** Amsterdam HH:MM clock-in. */
  startLabel: string
  /** Elapsed hours from clock-in until now. */
  hoursWorked: number
  /** Loaded employer cost so far (cost_per_hour × hours). */
  wages: number
}

export type VenueStripActiveWorkersDto = {
  workers: number
  rows: VenueStripActiveWorkerRowDto[]
}

/** Per-person line for KPI gewerkte drawers (Afwas may appear twice after 50/50 split). */
export type VenueStripWorkerLineDto = {
  userId: string
  userName: string
  teamName: string
  bucket: 'keuken' | 'bediening' | 'overig'
  hours: number
  /** Loaded employer cost (Eitje-style). */
  wages: number
  /** Amsterdam HH:MM from Eitje shift clock-in. */
  startLabel?: string
  /** Amsterdam HH:MM — omitted on open shifts (today); inbox fallback on sealed days. */
  endLabel?: string
}

export type VenueStripCardDto = {
  locationId: string
  locationName: string
  revenue: {
    total: number
    food: number
    beverage: number
    totalIncVat: number
    foodIncVat: number
    beverageIncVat: number
  }
  labor: {
    /** All shift types and teams (Ziek, Management, Afwas, …). */
    all: VenueStripLaborRowDto
    /** Gewerkte uren operational total (Keuken + Bediening incl. Afwas 50/50). */
    gewerkt: VenueStripLaborRowDto
    keuken: VenueStripLaborRowDto
    bediening: VenueStripLaborRowDto
    /** All hours − gewerkt (Ziek, Management, Algemeen, …). */
    other: VenueStripLaborRowDto
  }
  /** Staff lines for gewerkte KPI drawers, same source as labor totals. */
  workers: VenueStripWorkerLineDto[]
  /** Open Eitje shifts (today only): clocked in, not yet clocked out. */
  active: VenueStripActiveWorkersDto
  productivity: {
    totalPerHour: number | null
    keukenPerHour: number | null
    bedieningPerHour: number | null
  }
  contractsByTeam: {
    keuken: VenueStripContractRowDto[]
    bediening: VenueStripContractRowDto[]
    other: VenueStripContractRowDto[]
  }
  coverage: {
    hasRevenue: boolean
    hasLabor: boolean
    snapshotBuilt: boolean
  }
}

export type VenueStripResponseDto = {
  range: DailyOpsRangeDto
  venues: VenueStripCardDto[]
}

export type DailyOpsAttendanceKpiKind = 'planned' | 'leave' | 'sick'

export type DailyOpsAttendanceStaffRowDto = {
  userId: string
  userName: string
  teamName: string
  hours: number
  actualHours?: number
  loaded: number
  startLabel?: string
  endLabel?: string
  fromLabel?: string
  toLabel?: string
  reason?: string
  status?: string
}

export type DailyOpsAttendanceVenueDto = {
  locationId: string
  locationName: string
  workers: number
  hours: number
  loaded: number
  rows: DailyOpsAttendanceStaffRowDto[]
}

export type DailyOpsAttendanceKpiBlockDto = {
  workers: number
  hours: number
  loaded: number
  venues: DailyOpsAttendanceVenueDto[]
}

export type DailyOpsAttendanceKpisDto = {
  range: DailyOpsRangeDto
  planned: DailyOpsAttendanceKpiBlockDto
  leave: DailyOpsAttendanceKpiBlockDto
  sick: DailyOpsAttendanceKpiBlockDto
}

export type DailyOpsContractHoursVarianceSeverity = 'warning' | 'critical'

export type DailyOpsContractHoursVarianceRowDto = {
  memberId: string
  userName: string
  teamName: string
  contractType: string | null
  workedHours: number
  contractHours: number
  deltaHours: number
  verlofHours: number | null
  baselineSnapshotDate: string | null
  severity: DailyOpsContractHoursVarianceSeverity
}

export type DailyOpsContractHoursVarianceDto = {
  range: { startDate: string; endDate: string }
  weeks: number
  thresholdHours: number
  criticalHours: number
  workers: number
  rows: DailyOpsContractHoursVarianceRowDto[]
}
