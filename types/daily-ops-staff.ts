/**
 * @registry-id: dailyOpsStaffTypes
 * @created: 2026-06-10T12:00:00.000Z
 * @last-modified: 2026-06-10T12:00:00.000Z
 * @description: Types for Daily Ops Staff hub + weekly hours KPI
 * @last-fix: [2026-06-10] Initial staff weekly hours types
 *
 * @exports-to:
 * ✓ server/utils/memberWeeklyHours.ts
 * ✓ composables/useStaffWeeklyHours.ts
 * ✓ composables/useDailyOpsStaffMetrics.ts
 * ✓ components/daily-ops/staff/*
 */

export type StaffWeeklyHoursWeek = {
  week_key: string
  week_label: string
  worked_hours: number
  planned_hours: number
  contract_hours: number | null
  delta_vs_contract: number | null
  delta_vs_planned: number | null
  days_in_range: number
}

export type StaffWeeklyHoursTotals = {
  worked_hours: number
  planned_hours: number
  contract_hours: number | null
  delta_vs_contract: number | null
  avg_weekly_delta: number | null
}

export type StaffWeeklyHoursPayload = {
  member_id: string
  member_name: string
  range_start: string
  range_end: string
  contract_weekly: number | null
  contract_type: string | null
  weeks: StaffWeeklyHoursWeek[]
  totals: StaffWeeklyHoursTotals
  planned_coverage_pct: number | null
  data_gap: boolean
  has_eitje_match: boolean
}

export type StaffWeeklyHoursPreset = 'ytd' | '3m' | '6mo'

export type DailyOpsStaffQueryContext = {
  period: string
  startDate: string
  endDate: string
  label: string
  locationId?: string
}

export type DailyOpsStaffTeamSeriesPoint = {
  teamName: string
  hours: number
  gewerkt_hours: number
  staff_count: number
}

export type DailyOpsStaffTimeseriesPoint = {
  date: string
  hours: number
  gewerkt_hours: number
  staff_count: number
  teams?: DailyOpsStaffTeamSeriesPoint[]
}

export type DailyOpsStaffLocationSeries = {
  locationId: string
  locationName: string
  points: DailyOpsStaffTimeseriesPoint[]
  totals: { hours: number; staff_count: number }
}

export type DailyOpsStaffTimeseriesDto = {
  granularity: 'day' | 'week' | 'month' | 'year'
  label: string
  current: DailyOpsStaffTimeseriesPoint[]
  byLocation?: DailyOpsStaffLocationSeries[]
  totals: { hours: number; staff_count: number }
  coverage: { daysFound: number; daysExpected: number }
}

export type DailyOpsStaffRollingStat = {
  median: number
  mean: number
  p25: number
  p75: number
}

export type DailyOpsStaffRollingSeriesPoint = {
  date: string
  hours: number
  staff_count: number
}

export type DailyOpsStaffRollingWindow = {
  label: string
  hours: DailyOpsStaffRollingStat
  staff_count: DailyOpsStaffRollingStat
  series: DailyOpsStaffRollingSeriesPoint[]
}

export type DailyOpsStaffRollingMediansDto = {
  periodMedian: { hours: number; staff_count: number }
  windows: DailyOpsStaffRollingWindow[]
}

export type DailyOpsStaffPlusminMemberRow = {
  memberId: string
  userName: string
  teamName: string
  contractType: string | null
  displayDelta: number
  monthDelta: number
  weekDelta: number
  workedHours: number
  contractHours: number
}

export type DailyOpsStaffPlusminVenueRow = {
  locationId: string
  locationName: string
  worked: number
  contract: number
  delta: number
  plusHours: number
  minusHours: number
}

export type DailyOpsStaffPlusminSummaryDto = {
  display: { startDate: string; endDate: string; label: string }
  month: {
    startDate: string
    endDate: string
    label: string
    overThreshold: number
    underThreshold: number
  }
  week: {
    startDate: string
    endDate: string
    label: string
    overThreshold: number
    underThreshold: number
  }
  totals: {
    worked: number
    contract: number
    delta: number
    plusHours: number
    minusHours: number
  }
  byVenue: DailyOpsStaffPlusminVenueRow[]
  monthKpis: { over: DailyOpsStaffPlusminMemberRow[]; under: DailyOpsStaffPlusminMemberRow[] }
  weekKpis: { over: DailyOpsStaffPlusminMemberRow[]; under: DailyOpsStaffPlusminMemberRow[] }
  members: DailyOpsStaffPlusminMemberRow[]
}
