/**
 * @registry-id: dailyOpsSnapshotResolveSources
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-25T12:23:00.000Z
 * @description: Counts source-collection rows + captures lastSyncAt for snapshot provenance.
 *   Reads only — no writes. Aggregated collections only (no raw scans).
 * @last-fix: [2026-05-25] PERMANENT FIX: Use SSOT cron priority instead of raw cron_hour sorting (prevents intraday cron_hour=23 from overriding morning cron_hour=8)
 * @adr-ref: ADR-004 (Daily Ops snapshot = authoritative revenue source)
 *
 * @architecture:
 *   - One read per source collection (bork_business_days, eitje_time_registration_aggregation,
 *     inbox-bork-basis-report) scoped to (businessDate, locationId).
 *   - Returns SnapshotSourceFingerprint per source — stored on master.sources for debugging.
 *   - SSOT: Pick report by cron priority (3=morning, 2=23:00, 1=18:00), then received_at DESC.
 *
 * @exports-to:
 *   ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type { SnapshotSourceFingerprint } from '../../../types/daily-ops-snapshot'
import { pickMorningFinalBasisReport, type BasisReportData } from '../inbox/basis-report-mapper'

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

  const [borkCount, borkLast, eitjeCount, eitjeLast, inboxDocs] = await Promise.all([
    locOid
      ? db.collection('bork_business_days').countDocuments({ business_date: businessDate, locationId: locOid })
      : 0,
    locOid
      ? db
          .collection('bork_business_days')
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
      `[snapshot:sources] ${businessDate} loc=${locStr} | bork=${borkCount} eitje=${eitjeCount} inbox=${inboxDocs.length} (cron=${lastInboxCron})`
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
      collection: 'bork_business_days',
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
