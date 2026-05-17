import type { DailyOpsProfitIntervalKey } from '~/types/daily-ops-dashboard'

export const DAILY_OPS_PROFIT_INTERVALS: {
  key: DailyOpsProfitIntervalKey
  label: string
}[] = [
  { key: 'lunch', label: 'Lunch' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'late_night', label: 'Late Night' },
]

/** Soft Pantone-inspired slice colors — one per time-of-day interval (not profit sign). */
export const DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS: Record<DailyOpsProfitIntervalKey, string> = {
  lunch: '#8EB4C8',
  afternoon: '#D4B896',
  dinner: '#A89BC4',
  late_night: '#94BFA8',
}

export const DAILY_OPS_PROFIT_STATUS_RING = {
  positive: '#5B9A6F',
  negative: '#C97B7B',
  neutral: '#B8B8B8',
} as const

/** Fixed table columns: combined + three venues (matches venue strip). */
export const DAILY_OPS_PROFIT_VENUE_LOCATIONS: {
  locationId: string
  label: string
  short: string
}[] = [
  { locationId: '69d6cfa63d2adf93b79d1ae7', label: 'Van Kinsbergen', short: 'VKB' },
  { locationId: '69d6cfa63d2adf93b79d1ae6', label: 'Bar Bea', short: 'BEA' },
  { locationId: '69d6cfa73d2adf93b79d1ae8', label: "l'Amour Toujours", short: 'LAT' },
]

export const DAILY_OPS_PROFIT_TABLE_LOCATIONS: {
  locationId: string | null
  label: string
  short: string
}[] = [
  { locationId: null, label: 'All locations', short: 'All' },
  ...DAILY_OPS_PROFIT_VENUE_LOCATIONS,
]

export const DAILY_OPS_PROFIT_INTERVAL_KPIS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'laborCost', label: 'Labor' },
  { key: 'cogsCost', label: 'Cost of sales' },
  { key: 'fixedCost', label: 'Fixed costs' },
  { key: 'profit', label: 'Profit (est.)' },
] as const

export type DailyOpsProfitIntervalKpiKey = (typeof DAILY_OPS_PROFIT_INTERVAL_KPIS)[number]['key']

export type ProfitIntervalSlice = {
  key: DailyOpsProfitIntervalKey
  label: string
  profit: number
  hasData: boolean
}
