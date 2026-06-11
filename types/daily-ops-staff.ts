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
