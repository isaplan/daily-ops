/**
 * Post-rebuild labor aggregation integrity (dedupe by business key).
 */
import type { Db } from 'mongodb'
import { fixAggregationDuplicates } from '../services/dataIntegrityService'

export async function runEitjeLaborAggIntegrity (
  _db: Db,
  startDate: string,
  endDate: string
): Promise<number> {
  return fixAggregationDuplicates({ startDate, endDate })
}
