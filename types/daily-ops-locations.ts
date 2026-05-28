export type DailyOpsLocationRowDto = {
  _id: string
  name: string
  abbreviation: string
  eitjeId?: string | number
  chartColor: string
}

export type DailyOpsLocationsResponseDto = {
  success: boolean
  data: DailyOpsLocationRowDto[]
  error?: string
}
