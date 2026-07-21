/**
 * @registry-id: dailyOpsVenueTablesTypes
 * @created: 2026-07-17T18:05:00.000Z
 * @last-modified: 2026-07-20T00:00:00.000Z
 * @description: Learned Bork table inventory per venue (catalog for bezettingsgraad)
 * @last-fix: [2026-07-20] Avg-daily aggregation + optional daily series
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueTables/upsertKnownTables.ts
 * ✓ server/utils/dailyOpsVenueTables/fetchTableOccupancyKpis.ts
 * ✓ server/utils/dailyOpsVenueTables/buildTableOccupancySummary.ts
 * ✓ types/daily-ops-dashboard.ts
 */

/** One physical/Bork table seen at a venue (grows as Bork data arrives). */
export type DailyOpsVenueTableDoc = {
  locationId: string
  locationName: string
  tableNum: string
  locationSpace?: string
  firstSeenAt: Date
  lastSeenAt: Date
  /** Last business_date this table appeared in Bork table agg / snapshot. */
  lastBusinessDate?: string
}

export type DailyOpsTableOccupancyVenueDto = {
  locationId: string
  locationName: string
  /** Distinct tables with orders (single day) or average daily active (multi-day). */
  activeTables: number
  totalTables: number
  /** activeTables / totalTables × 100 when totalTables > 0 (avg of daily % when multi-day). */
  occupancyPct: number | null
}

export type DailyOpsTableOccupancyDayDto = {
  date: string
  locationId: string
  locationName: string
  activeTables: number
  totalTables: number
  occupancyPct: number | null
}

export type DailyOpsTableOccupancyKpisDto = {
  range: {
    period: string
    startDate: string
    endDate: string
  }
  activeTables: number
  totalTables: number
  occupancyPct: number | null
  venues: DailyOpsTableOccupancyVenueDto[]
  /** Present for multi-day ranges (per venue × day). */
  daily?: DailyOpsTableOccupancyDayDto[]
  /** How activeTables / occupancyPct were aggregated. */
  aggregation?: 'day' | 'avg_daily'
}
