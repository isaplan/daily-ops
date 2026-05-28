/**
 * @registry-id: dailyOpsRunPostSealRetention
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Post-seal retention: archive raw to blob + purge fat bork slices (ADR-006)
 * @adr-ref: ADR-006
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { archiveRawDay } from './archiveRawDay'
import { readDailyOpsBlobConfig, spacesConfigured } from './config'
import { purgeFatBorkSlicesForVenueDay } from './purgeFatBorkSlices'

export type PostSealRetentionResult = {
  archive?: Awaited<ReturnType<typeof archiveRawDay>>
  purge?: Awaited<ReturnType<typeof purgeFatBorkSlicesForVenueDay>>
  skipped: string[]
}

/** Run after snapshot seal when env flags enabled. Never throws — logs via skipped. */
export async function runPostSealRetention(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<PostSealRetentionResult> {
  const cfg = readDailyOpsBlobConfig()
  const skipped: string[] = []
  let archive: PostSealRetentionResult['archive']
  let purge: PostSealRetentionResult['purge']

  if (cfg.archiveEnabled && spacesConfigured(cfg)) {
    try {
      archive = await archiveRawDay(db, { businessDate, locationId })
    } catch (e) {
      skipped.push(`archive failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  } else if (cfg.archiveEnabled) {
    skipped.push('archive enabled but DO Spaces not configured')
  }

  if (cfg.purgeFatAggregatesEnabled) {
    try {
      purge = await purgeFatBorkSlicesForVenueDay(db, businessDate, locationId)
    } catch (e) {
      skipped.push(`purge failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { archive, purge, skipped }
}
