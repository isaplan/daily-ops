import type { Db } from 'mongodb'
import type { DailyOpsRevenueCoOccurrenceDto, DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'

/** v1 stub — basket pairs require ticket-level re-parse (Phase 8). */
export async function fetchCoOccurrence(
  _db: Db,
  _ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueCoOccurrenceDto> {
  return {
    pairs: [],
    note: 'Co-occurrence analyse volgt in een latere release (ticket-level parsing).',
  }
}
