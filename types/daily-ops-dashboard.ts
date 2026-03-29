export const DAILY_OPS_PERIOD_IDS = ['today', 'yesterday', 'this-week', 'last-week'] as const

export type DailyOpsPeriodId = (typeof DAILY_OPS_PERIOD_IDS)[number]

export type DailyOpsRangeDto = {
  period: string
  startDate: string
  endDate: string
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
