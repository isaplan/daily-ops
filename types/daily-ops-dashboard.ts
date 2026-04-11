export const DAILY_OPS_PERIOD_IDS = ['today', 'yesterday', 'this-week', 'last-week'] as const

export type DailyOpsPeriodId = (typeof DAILY_OPS_PERIOD_IDS)[number]

export type DailyOpsRangeDto = {
  period: string
  startDate: string
  endDate: string
}

export type DailyOpsSummaryDto = {
  range: DailyOpsRangeDto
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
  }
  vatDisclaimer: string
}

export type DailyOpsRevenueBreakdownDto = {
  range: DailyOpsRangeDto
  revenueByCategory: { key: string; label: string; amount: number }[]
  revenueByTimePeriod: { key: string; label: string; amount: number }[]
  mostProfitableHour: {
    hourLabel: string
    date: string
    revenue: number
    laborCost: number
    profit: number
  }
}

export type DailyOpsLaborDayDto = {
  date: string
  revenue: number
  laborCost: number
  hours: number
  laborCostPctOfRevenue: number | null
  revenuePerLaborHour: number | null
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
  hoursCostByContractType: {
    contractType: string
    totalHours: number
    totalCost: number
  }[]
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
  mostProfitableHour: {
    hourLabel: string
    date?: string
    revenue: number
    laborCost: number
    profit: number
  }
  vatDisclaimer: string
}

export type DailyOpsSectionStubDto = {
  range: DailyOpsRangeDto
  section: string
  title: string
  message: string
}
