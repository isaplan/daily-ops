/** Per-location revenue space: maps Bork table numbers to a named space. */
export type LocationRevenueSpaceTableRange = {
  min: number
  max: number
}

export type LocationRevenueSpace = {
  id: string
  name: string
  tableRanges: LocationRevenueSpaceTableRange[]
  individualTables: number[]
}

export type LocationRevenueSpacesResponseDto = {
  success: boolean
  data: {
    locationId: string
    locationName: string
    spaces: LocationRevenueSpace[]
    seeded: boolean
  }
  error?: string
}

export type LocationRevenueSpacesPutBody = {
  spaces: LocationRevenueSpace[]
  rebuildDays?: number
}
