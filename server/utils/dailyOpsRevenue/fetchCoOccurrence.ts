/**
 * @registry-id: dailyOpsRevenueFetchCoOccurrence
 * @last-modified: 2026-05-24T15:30:00.000Z
 * @last-fix: [2026-05-24] ADR-004: removed live bork_raw_data scan on GET; pending snapshot section
 * @adr-ref: ADR-004
 */
import type { Db } from 'mongodb'
import type {
  DailyOpsRevenueCoOccurrenceDto,
  DailyOpsRevenueQueryContext,
} from '~/types/daily-ops-revenue'

/** Co-occurrence pairs require a dedicated snapshot section (ADR-004). No live raw reads on GET. */
export async function fetchCoOccurrence(
  _db: Db,
  _ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueCoOccurrenceDto> {
  return {
    pairs: [],
    note:
      'Co-occurrence is temporarily unavailable: data must be precomputed in daily_ops_snapshot (ADR-004). Rebuild snapshot pipeline to enable.',
  }
}
