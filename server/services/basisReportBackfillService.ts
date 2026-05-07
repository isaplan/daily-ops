/**
 * @registry-id: basisReportBackfillService
 * @created: 2026-05-07T00:00:00.000Z
 * @last-modified: 2026-05-07T00:00:00.000Z
 * @description: Remap inbox-bork-basis-report from parseddatas using current basis-report mapper + location helpers
 * @last-fix: [2026-05-07] Initial backfill + stale legacy Unknown/Unspecified cleanup (no source_attachment_id)
 *
 * @exports-to:
 * ✓ server/api/inbox/backfill-basis-reports.post.ts
 */

import { ObjectId, type Document } from 'mongodb'
import { getDb } from '../utils/db'
import { INBOX_COLLECTIONS } from '../utils/inbox/constants'
import { mapBasisReportXLSX } from '../utils/inbox/basis-report-mapper'
import type { FileFormat } from '~/types/inbox'

const STALE_LOCATIONS = ['Unknown', 'Unspecified', 'UNKNOWN'] as const

export type BasisReportBackfillOptions = {
  /** When true, compute counts + errors only — no writes */
  dryRun?: boolean
  /** After upserts, delete legacy rows that lack metadata.source_attachment_id and use stale location labels */
  cleanupStaleLegacy?: boolean
}

export type BasisReportBackfillResult = {
  parsedGroups: number
  processed: number
  upserted: number
  skipped: number
  staleLegacyRemoved: number
  errors: Array<{ attachmentId: string; message: string }>
}

export async function backfillBasisReportsFromParsedData(
  options: BasisReportBackfillOptions = {},
): Promise<BasisReportBackfillResult> {
  const dryRun = Boolean(options.dryRun)
  const cleanupStaleLegacy = options.cleanupStaleLegacy !== false

  const db = await getDb()
  const parsedCol = db.collection(INBOX_COLLECTIONS.parsedData)

  const grouped = await parsedCol
    .aggregate<Document>([
      { $match: { documentType: 'basis_report' } },
      { $sort: { extractedAt: -1 as const, _id: -1 } },
      {
        $group: {
          _id: '$attachmentId',
          doc: { $first: '$$ROOT' },
        },
      },
    ])
    .toArray()

  let processed = 0
  let upserted = 0
  let skipped = 0
  const errors: Array<{ attachmentId: string; message: string }> = []

  for (const g of grouped) {
    const doc = g.doc as Document | undefined
    const rawAtt = doc?.attachmentId ?? g._id
    if (rawAtt == null || rawAtt === '') {
      skipped++
      continue
    }

    const attachmentIdStr = String(rawAtt)
    processed++

    try {
      const attOid = rawAtt instanceof ObjectId ? rawAtt : new ObjectId(attachmentIdStr)
      const attachment = await db.collection(INBOX_COLLECTIONS.emailAttachment).findOne({ _id: attOid })

      const emailOidRaw = doc?.emailId ?? attachment?.emailId
      const emailOid =
        emailOidRaw instanceof ObjectId ? emailOidRaw : emailOidRaw ? new ObjectId(String(emailOidRaw)) : null

      const email = emailOid ? await db.collection(INBOX_COLLECTIONS.inboxEmail).findOne({ _id: emailOid }) : null

      const data = doc?.data as
        | { headers?: string[]; rows?: Record<string, unknown>[]; metadata?: Record<string, unknown> }
        | undefined
      const headers = Array.isArray(data?.headers) ? data!.headers! : []
      const rows = Array.isArray(data?.rows) ? data!.rows! : []
      const rowCount = rows.length

      const parseResult = {
        success: true as const,
        format: (doc?.format as FileFormat) || ('xlsx' as FileFormat),
        headers,
        rows,
        rowCount,
        metadata: data?.metadata ?? {},
      }

      const fileName = attachment?.fileName != null ? String(attachment.fileName) : 'basis.xlsx'

      const basisReport = await mapBasisReportXLSX(
        parseResult,
        fileName,
        {
          subject: email?.subject != null ? String(email.subject) : undefined,
          receivedAt:
            email?.receivedAt instanceof Date
              ? email.receivedAt
              : email?.receivedAt != null
                ? new Date(String(email.receivedAt))
                : undefined,
          emailId: emailOid ? String(emailOid) : undefined,
          attachmentId: attachmentIdStr,
        },
        db,
      )

      if (!basisReport) {
        errors.push({ attachmentId: attachmentIdStr, message: 'Mapper returned null (empty or invalid rows)' })
        continue
      }

      if (!dryRun) {
        await db.collection('inbox-bork-basis-report').updateOne(
          { 'metadata.source_attachment_id': attachmentIdStr },
          { $set: { ...basisReport, updated_at: new Date() } },
          { upsert: true },
        )
      }
      upserted++
    } catch (e) {
      errors.push({
        attachmentId: attachmentIdStr,
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  let staleLegacyRemoved = 0
  if (!dryRun && cleanupStaleLegacy) {
    const r = await db.collection('inbox-bork-basis-report').deleteMany({
      location: { $in: [...STALE_LOCATIONS] },
      'metadata.source_attachment_id': { $exists: false },
    })
    staleLegacyRemoved = r.deletedCount ?? 0
  }

  return {
    parsedGroups: grouped.length,
    processed,
    upserted,
    skipped,
    staleLegacyRemoved,
    errors,
  }
}
