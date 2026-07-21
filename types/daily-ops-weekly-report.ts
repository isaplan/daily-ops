/**
 * @registry-id: dailyOpsWeeklyReportTypes
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-07-20T00:00:00.000Z
 * @description: Weekly digest DTOs — read-cache profile weekly-digest (ADR-013)
 * @last-fix: [2026-07-20] tableOccupancy + rolling12 occupancy comparisons
 * @adr-ref: ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeeklyReport/*
 * ✓ server/api/daily-ops/analytics/weekly-digest.get.ts
 * ✓ composables/useDailyOpsWeeklyReport.ts
 * ✓ components/daily-ops/analytics/*
 */

export const WEEKLY_DIGEST_PROFILE = 'weekly-digest'

export const WEEKLY_TARGET_PRESETS = {
  standard: { laborGoodPct: 30, laborOkayPct: 35, pnlTargetPct: 15 },
  strict: { laborGoodPct: 28, laborOkayPct: 32, pnlTargetPct: 18 },
  relaxed: { laborGoodPct: 32, laborOkayPct: 38, pnlTargetPct: 12 },
} as const

export type WeeklyTargetPresetId = keyof typeof WEEKLY_TARGET_PRESETS

export type WeeklyPerformanceStatus = 'good' | 'okay' | 'bad'

export type WeeklyTargetsDto = {
  presetId: WeeklyTargetPresetId
  laborGoodPct: number
  laborOkayPct: number
  pnlTargetPct: number
}

export type WeeklyCompareMetric = {
  value: number
  benchmark: number
  delta: number
  pct: number | null
}

export type WeeklyDayBreakdown = {
  businessDate: string
  dayOfWeek: string
  revenue: number
  laborCost: number
  laborHours: number
  laborCostPct: number | null
  itemsCount: number
  margin: number
  /** Revenue − loaded labor (same-day). */
  profit: number
  /** Revenue − COGS − labor − overhead (est.). */
  pnlResult: number
  /** Revenue ÷ labor hours when hours > 0. */
  productivity: number | null
  staffCount: number
  prevWeekRevenue: number | null
  prevWeekDeltaPct: number | null
}

export type WeeklyTeamBreakdown = {
  key: 'keuken' | 'bediening' | 'other'
  label: string
  hours: number
  loadedCost: number
  laborCostPct: number | null
}

export type WeeklyStaffRanking = {
  workerId: string
  workerName: string
  teamName: string
  revenue: number
  itemsCount: number
  hours: number
  laborCost: number
  revenuePerHour: number | null
  laborCostPct: number | null
  dailyRevenue: { businessDate: string; revenue: number }[]
}

export type WeeklyHourlyLossCell = {
  businessDate: string
  businessHour: number
  hourLabel: string
  revenue: number
  laborCost: number
  margin: number
  status: WeeklyPerformanceStatus
}

export type WeeklySpaceMargin = {
  tableNum: string
  locationSpace: string
  revenue: number
  quantity: number
  estimatedLaborCost: number
  margin: number
}

export type WeeklyCategoryMargin = {
  key: 'food' | 'beverage' | 'other'
  label: string
  revenue: number
  cogs: number
  allocatedLabor: number
  margin: number
  status: WeeklyPerformanceStatus
}

export type WeeklyUpsellMetric = {
  key: 'water' | 'beer' | 'lemonade'
  label: string
  quantity: number
  revenue: number
}

export type WeeklyProductRow = {
  productName: string
  revenue: number
  quantity: number
}

export type WeeklyCompareTrend = {
  previousWeek: {
    label: string
    revenue: WeeklyCompareMetric
    laborCostPct: WeeklyCompareMetric
    pnlPct: WeeklyCompareMetric
    occupancyPct: WeeklyCompareMetric
  }
  rolling3Week: {
    label: string
    avgRevenue: number
    avgLaborCostPct: number | null
    avgPnlPct: number | null
    avgOccupancyPct: number | null
  }
  rolling6Week: {
    label: string
    avgRevenue: number
    avgLaborCostPct: number | null
    avgPnlPct: number | null
    avgOccupancyPct: number | null
  }
  rolling12Week: {
    label: string
    avgRevenue: number
    avgLaborCostPct: number | null
    avgPnlPct: number | null
    avgOccupancyPct: number | null
  }
}

export type WeeklyTableOccupancyVenue = {
  locationId: string
  locationName: string
  activeTables: number
  totalTables: number
  occupancyPct: number | null
}

/** Avg daily bezettingsgraad for the digest period (sealed at build). */
export type WeeklyTableOccupancySummary = {
  activeTables: number
  totalTables: number
  occupancyPct: number | null
  aggregation: 'day' | 'avg_daily'
  venues: WeeklyTableOccupancyVenue[]
}

export type WeeklyDigestTotals = {
  revenue: number
  revenueIncVat: number
  itemsCount: number
  laborCost: number
  laborHours: number
  laborCostPct: number | null
  revenuePerHour: number | null
  foodRevenue: number
  beverageRevenue: number
  pnlResult: number
  pnlPct: number | null
  staffCount: number
  laborStatus: WeeklyPerformanceStatus
  pnlStatus: WeeklyPerformanceStatus
}

export type WeeklyAttendanceStaffRow = {
  userId: string
  userName: string
  teamName: string
  hours: number
}

export type WeeklyAttendanceSummary = {
  ziekHours: number
  ziekStaffCount: number
  verlofStaffCount: number
  verlofHours: number
  ziekStaff: WeeklyAttendanceStaffRow[]
  verlofStaff: WeeklyAttendanceStaffRow[]
}

export type WeeklyStaffPlusminRow = {
  memberId: string
  userName: string
  teamName: string
  /** Comma-separated venue labels when digest is all-locations (empty when single venue). */
  locationLabel: string
  workedHours: number
  contractHours: number
  weekDelta: number
}

export type WeeklyStaffPlusminSummary = {
  plusHours: number
  minusHours: number
  netDelta: number
  overThreshold: number
  underThreshold: number
  over: WeeklyStaffPlusminRow[]
  under: WeeklyStaffPlusminRow[]
  members: WeeklyStaffPlusminRow[]
}

export type WeeklyOpeningClosingTeamHours = {
  preOpenHours: number
  postCloseHours: number
  outsideHours: number
}

export type WeeklyOpeningClosingSummary = {
  preOpenHours: number
  postCloseHours: number
  outsideHours: number
  keuken: WeeklyOpeningClosingTeamHours
  bediening: WeeklyOpeningClosingTeamHours
}

export type WeeklyDigestDto = {
  weekKey: string
  label: string
  startDate: string
  endDate: string
  locationId: string
  locationName: string
  targets: WeeklyTargetsDto
  coverage: { daysExpected: number; daysFound: number; missingDates: string[] }
  totals: WeeklyDigestTotals
  dailyBreakdown: WeeklyDayBreakdown[]
  teams: WeeklyTeamBreakdown[]
  comparisons: WeeklyCompareTrend
  staffRankings: WeeklyStaffRanking[]
  topProducts: WeeklyProductRow[]
  upsell: WeeklyUpsellMetric[]
  hourlyLoss: WeeklyHourlyLossCell[]
  spaceMargins: WeeklySpaceMargin[]
  categoryMargins: WeeklyCategoryMargin[]
  attendance: WeeklyAttendanceSummary
  staffPlusmin: WeeklyStaffPlusminSummary
  openingClosing: WeeklyOpeningClosingSummary
  tableOccupancy: WeeklyTableOccupancySummary
  dataGap: boolean
  builtAt: string
  /** Bump when digest shape / prev-week mapping changes (cache invalidation). */
  schemaVersion?: number
}
