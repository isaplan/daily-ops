import type { AccountingPnlRow } from '~/utils/accountingPnlData'

export type AccountingPnlVenueId = 'vkb' | 'bea' | 'lat'

export type AccountingPnlBenchmarkPeriodKind = 'annual' | 'monthly' | 'ytd'

/** One accounting P&L slice — stored in Mongo `accounting_pnl_benchmark`. */
export type AccountingPnlBenchmarkPeriodDoc = {
  year: number
  /** null = full year or YTD aggregate for that year row. */
  month: number | null
  periodKind: AccountingPnlBenchmarkPeriodKind
  periodLabel: string
  venues: Record<AccountingPnlVenueId, AccountingPnlRow>
  combined: AccountingPnlRow
  source: 'accounting_analyse_export' | 'manual_edit'
}

export type AccountingPnlBenchmarkTableLineDto = {
  key: string
  label: string
  row: AccountingPnlRow
}

export type AccountingPnlMonthGridVenueCell = {
  key: AccountingPnlVenueId
  shortLabel: string
  row: AccountingPnlRow
}

export type AccountingPnlMonthGridColumn = {
  month: number
  label: string
  venues: AccountingPnlMonthGridVenueCell[]
}

export type AccountingPnlMonthGridDto = {
  columns: AccountingPnlMonthGridColumn[]
}

export type AccountingPnlYearGridColumn = {
  year: number
  label: string
  venues: AccountingPnlMonthGridVenueCell[]
}

export type AccountingPnlYearGridDto = {
  columns: AccountingPnlYearGridColumn[]
}

export type AccountingPnlBenchmarkResponseDto = {
  periodLabel: string
  year: number
  month: number | null
  lines: AccountingPnlBenchmarkTableLineDto[]
  monthGrid?: AccountingPnlMonthGridDto
  yearGrid?: AccountingPnlYearGridDto
  availableYears: number[]
  availableMonths: number[]
}

export type AccountingPnlBenchmarkUpsertPeriodInput = {
  year: number
  month: number | null
  venues: Record<AccountingPnlVenueId, AccountingPnlRow>
}

export type AccountingPnlBenchmarkUpsertRequest = {
  periods: AccountingPnlBenchmarkUpsertPeriodInput[]
  /** When true, refresh org P&L assumptions from the first annual (month=null) combined row. */
  refreshAssumptions?: boolean
}

export type AccountingPnlBenchmarkUpsertResponse = {
  touched: number
  assumptionsUpdated: boolean
}
