import type { DailyOpsRevenuePeriodId } from '~/types/daily-ops-revenue'
import { REVENUE_ANALYTICS_PERIOD_IDS } from '~/types/daily-ops-revenue'
import { periodLabelNl } from '~/utils/dailyOpsRevenuePeriod'

export type RevenueLocationOption = {
  id: string | null
  label: string
  abbrev: string
}

export const REVENUE_LOCATIONS: RevenueLocationOption[] = [
  { id: null, label: 'Alle zaken', abbrev: 'All' },
  { id: '69d6cfa63d2adf93b79d1ae7', label: 'Van Kinsbergen', abbrev: 'VKB' },
  { id: '69d6cfa63d2adf93b79d1ae6', label: 'Bar Bea', abbrev: 'BEA' },
  { id: '69d6cfa73d2adf93b79d1ae8', label: "l'Amour Toujours", abbrev: 'LAT' },
]

export type RevenueSpaceOption = { id: string; label: string }

/** UI ruimtes per venue (API `space` query; table mapping may follow). */
export const REVENUE_SPACES_BY_LOCATION: Record<string, RevenueSpaceOption[]> = {
  all: [
    { id: 'restaurant', label: 'Restaurant' },
    { id: 'gevel', label: 'Gevel' },
    { id: 'parkeer', label: 'Parkeer' },
    { id: 'terras', label: 'Terras' },
    { id: 'kade', label: 'Kade' },
    { id: 'boot', label: 'Boot' },
  ],
  '69d6cfa63d2adf93b79d1ae7': [
    { id: 'restaurant', label: 'Restaurant' },
    { id: 'gevel', label: 'Gevel' },
    { id: 'parkeer', label: 'Parkeer' },
    { id: 'terras', label: 'Terras' },
  ],
  '69d6cfa63d2adf93b79d1ae6': [
    { id: 'restaurant', label: 'Restaurant' },
    { id: 'gevel', label: 'Gevel' },
    { id: 'kade', label: 'Kade' },
    { id: 'boot', label: 'Boot' },
  ],
  '69d6cfa73d2adf93b79d1ae8': [
    { id: 'restaurant', label: 'Restaurant' },
    { id: 'gevel', label: 'Gevel' },
    { id: 'parkeer', label: 'Parkeer' },
    { id: 'terras', label: 'Terras' },
  ],
}

const ANALYTICS_SET = new Set<string>(REVENUE_ANALYTICS_PERIOD_IDS)

export function isRevenueAnalyticsPeriod(id: string): id is DailyOpsRevenuePeriodId {
  return ANALYTICS_SET.has(id)
}

export type RevenuePeriodGroup = {
  id: string
  label: string
  options: { id: DailyOpsRevenuePeriodId; label: string }[]
}

export const REVENUE_PERIOD_GROUPS: RevenuePeriodGroup[] = [
  {
    id: 'week',
    label: 'Week',
    options: [
      { id: 'this-week', label: periodLabelNl('this-week') },
      { id: 'last-week', label: periodLabelNl('last-week') },
    ],
  },
  {
    id: 'month',
    label: 'Maand',
    options: [
      { id: 'this-month', label: periodLabelNl('this-month') },
      { id: 'last-month', label: periodLabelNl('last-month') },
    ],
  },
  {
    id: 'year',
    label: 'Jaar',
    options: [
      { id: 'this-year', label: periodLabelNl('this-year') },
      { id: 'last-year', label: periodLabelNl('last-year') },
      { id: 'year-2', label: periodLabelNl('year-2') },
    ],
  },
  {
    id: 'rolling',
    label: 'Rollend',
    options: [
      { id: 'last-7d', label: periodLabelNl('last-7d') },
      { id: 'last-14d', label: periodLabelNl('last-14d') },
      { id: 'last-30d', label: periodLabelNl('last-30d') },
    ],
  },
  {
    id: 'quarter',
    label: 'Kwartaal',
    options: [
      { id: 'q1', label: periodLabelNl('q1') },
      { id: 'q2', label: periodLabelNl('q2') },
      { id: 'q3', label: periodLabelNl('q3') },
      { id: 'q4', label: periodLabelNl('q4') },
      { id: 'last-q', label: periodLabelNl('last-q') },
    ],
  },
  {
    id: 'season',
    label: 'Seizoen',
    options: [
      { id: 'lente', label: periodLabelNl('lente') },
      { id: 'zomer', label: periodLabelNl('zomer') },
      { id: 'herfst', label: periodLabelNl('herfst') },
      { id: 'winter', label: periodLabelNl('winter') },
    ],
  },
]

export function revenueSpacesForLocation(locationId: string | null): RevenueSpaceOption[] {
  if (!locationId) return []
  return REVENUE_SPACES_BY_LOCATION[locationId] ?? []
}

export function isSpaceValidForLocation(locationId: string | null, spaceId: string | null): boolean {
  if (!spaceId) return true
  if (!locationId) return true
  return revenueSpacesForLocation(locationId).some((s) => s.id === spaceId)
}

export function periodGroupForPeriod(period: DailyOpsRevenuePeriodId): string {
  for (const g of REVENUE_PERIOD_GROUPS) {
    if (g.options.some((o) => o.id === period)) return g.id
  }
  return 'week'
}
