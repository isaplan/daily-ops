/**
 * @registry-id: dailyOpsSnapshotResolveSources
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-07-13T00:58:00.000Z
 * @description: Counts source-collection rows + captures lastSyncAt for snapshot provenance.
 *   Reads only — no writes. Aggregated collections only (no raw scans).
 * @last-fix: [2026-07-13] FIX: Use resolveBorkAggReadSuffix() to read from live bork_business_days_v2, not stale bork_business_days table (was always returning 0 Bork rows post-May 2026 migration)
 * @adr-ref: ADR-004 (Daily Ops snapshot = authoritative revenue source)
 *
 * @architecture:
 *   - One read per source collection via resolveBorkAggReadSuffix() for Bork table suffix (defaults _v2):
 *     · bork_business_days${suffix} (live v2 table with all current venues/dates)
 *     · eitje_time_registration_aggregation (labor + planning aggregates, string locationId)
 *     · inbox-bork-basis-report (morning/intraday revenue finalization, string location_id)
 *   - Returns SnapshotSourceFingerprint per source — stored on master.sources for debugging.
 *   - SSOT: Pick report by cron priority (3=morning, 2=23:00, 1=18:00), then received_at DESC.
 *
 * @exports-to:
 *   ✓ server/services/dailyOpsSnapshotService.ts => buildDailyOpsSnapshot() uses fingerprint for provenance logging
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type { SnapshotSourceFingerprint } from '../../../types/daily-ops-snapshot'
import { pickMorningFinalBasisReport, type BasisReportData } from '../inbox/basis-report-mapper'
import { resolveBorkAggReadSuffix } from '../../borkAggVersionSuffix'

export type SourcesFingerprint = {
  bork: SnapshotSourceFingerprint
  eitje: SnapshotSourceFingerprint
  inbox: SnapshotSourceFingerprint
}

export async function resolveSources(
  db: Db,
  businessDate: string,
  locationId: string | ObjectId
): Promise<SourcesFingerprint> {
  const locStr = String(locationId)
  // bork_*.locationId is ObjectId; eitje + inbox use string (live verified 2026-05-13).
  const locOid = ObjectId.isValid(locStr) ? new ObjectId(locStr) : null

  const borkSuffix = resolveBorkAggReadSuffix()
  const borkCollection = `bork_business_days${borkSuffix}`

  const [borkCount, borkLast, eitjeCount, eitjeLast, inboxDocs] = await Promise.all([
    locOid
      ? db.collection(borkCollection).countDocuments({ business_date: businessDate, locationId: locOid })
      : 0,
    locOid
      ? db
          .collection(borkCollection)
          .findOne(
            { business_date: businessDate, locationId: locOid },
            { sort: { _id: -1 }, projection: { _id: 1 } }
          )
      : null,
    db
      .collection('eitje_time_registration_aggregation')
      .countDocuments({ period: businessDate, locationId: locStr }),
    db
      .collection('eitje_time_registration_aggregation')
      .findOne(
        { period: businessDate, locationId: locStr },
        { sort: { _id: -1 }, projection: { _id: 1 } }
      ),
    db
      .collection('inbox-bork-basis-report')
      .find({ business_date: businessDate, location_id: locStr })
      .project({ cron_hour: 1, received_at: 1 })
      .toArray(),
  ])

  const chosenInbox =
    pickMorningFinalBasisReport(inboxDocs as unknown as BasisReportData[]) ?? null
  const lastInboxCron = chosenInbox?.cron_hour ?? null
  const lastInboxAt = chosenInbox?.received_at ?? null

  if (String(process.env.DEBUG ?? '').includes('snapshot:sources')) {
    console.info(
      `[snapshot:sources] ${businessDate} loc=${locStr} | bork=${borkCount} (${borkCollection}) eitje=${eitjeCount} inbox=${inboxDocs.length} (cron=${lastInboxCron})`
    )
  }

  const objectIdToDate = (id: unknown): Date | null => {
    try {
      // Mongo ObjectId carries a creation timestamp
      return id && typeof (id as { getTimestamp?: () => Date }).getTimestamp === 'function'
        ? (id as { getTimestamp: () => Date }).getTimestamp()
        : null
    } catch {
      return null
    }
  }

  return {
    bork: {
      collection: borkCollection,
      doc_count: borkCount,
      lastSyncAt: borkLast ? objectIdToDate(borkLast._id) : null,
    },
    eitje: {
      collection: 'eitje_time_registration_aggregation',
      doc_count: eitjeCount,
      lastSyncAt: eitjeLast ? objectIdToDate(eitjeLast._id) : null,
    },
    inbox: {
      collection: 'inbox-bork-basis-report',
      doc_count: inboxDocs.length,
      lastSyncAt: lastInboxAt ?? null,
      cronHour: lastInboxCron,
    },
  }
}
