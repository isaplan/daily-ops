/**
 * @registry-id: opsNotificationDetectorUnparsedBasis
 * @created: 2026-05-28T00:00:00.000Z
 * @description: Morning Basis row €0 with attachment data — auto-retry parse once, then open/fixed alert.
 * @last-fix: [2026-05-28] One-shot retry via retryProcessEmailAttachments; fixed when revenue/categories populate.
 */

import type { Db } from 'mongodb'
import { ObjectId, type ObjectId as ObjectIdType } from 'mongodb'
import type { OpsNotificationDto } from '~/types/ops-notifications'
import { INBOX_COLLECTIONS } from '../../inbox/constants'
import { retryProcessEmailAttachments } from '../../../services/inboxProcessService'

function toObjectId(id: string): ObjectIdType | null {
  try {
    return ObjectId.isValid(id) ? new ObjectId(id) : null
  } catch {
    return null
  }
}

function basisRowLooksParsed(row: {
  final_revenue_ex_vat?: number
  sections?: { netto_sales?: { categories?: unknown[] } }
}): boolean {
  const ex = Number(row.final_revenue_ex_vat ?? 0)
  const cats = row.sections?.netto_sales?.categories?.length ?? 0
  return ex > 0 || cats > 0
}

export async function detectUnparsedBasisAttachments(
  db: Db,
  businessDate: string,
  opts?: { allowAutoRetry?: boolean },
): Promise<OpsNotificationDto[]> {
  const alerts: OpsNotificationDto[] = []

  const zeroRevenueRows = await db
    .collection('inbox-bork-basis-report')
    .find({
      business_date: businessDate,
      cron_hour: { $in: [7, 8] },
      final_revenue_ex_vat: { $lte: 0 },
      'metadata.source_attachment_id': { $exists: true, $ne: null },
    })
    .toArray()

  for (const row of zeroRevenueRows) {
    const attId = String(row.metadata?.source_attachment_id ?? '')
    const emailId = String(row.metadata?.source_email_id ?? '')
    if (!attId || !emailId) continue

    const attOid = toObjectId(attId)
    if (!attOid) continue
    const attachment = await db
      .collection(INBOX_COLLECTIONS.emailAttachment)
      .findOne({ _id: attOid })
    if (!attachment) continue

    const hasData =
      (attachment.originalData != null && String(attachment.originalData).length > 0) ||
      Number(attachment.fileSize ?? 0) > 0
    if (!hasData) continue

    const parsedData = await db.collection(INBOX_COLLECTIONS.parsedData).findOne({
      attachmentId: attId,
    })

    const needsRetry = !parsedData || !basisRowLooksParsed(row)
    if (!needsRetry) continue

    const retry =
      opts?.allowAutoRetry !== false
        ? await retryProcessEmailAttachments(emailId, { attachmentId: attId })
        : {
            success: false,
            attachmentsProcessed: 0,
            attachmentsFailed: 0,
            error: 'Auto-retry skipped (outside recent window)',
          }

    const rowAfter = await db.collection('inbox-bork-basis-report').findOne({ _id: row._id })
    const isFixed = rowAfter != null && basisRowLooksParsed(rowAfter)

    alerts.push({
      id: `unparsed_basis_attachment:${businessDate}:${row.location_id}`,
      category: 'cron',
      kind: 'unparsed_basis_attachment',
      severity: 'warning',
      status: isFixed ? 'fixed' : 'open',
      businessDate,
      locationId: String(row.location_id ?? ''),
      locationName: String(row.location ?? ''),
      title: isFixed
        ? `${row.location}: Basis attachment reprocessed`
        : `${row.location}: Morning Basis attachment not parsed`,
      message: isFixed
        ? `Auto-retry parsed "${attachment.fileName}" — revenue/categories are now populated.`
        : `Attachment "${attachment.fileName}" has data but morning revenue is still €0. Use Try fix to reprocess once.${
            retry.error ? ` ${retry.error}` : ''
          }`,
      ...(isFixed
        ? {
            solution:
              'Ran attachment reprocess once automatically; Basis report now has revenue and/or Dranken/Keuken categories.',
          }
        : {
            fixHint: 'POST the suggested endpoint to retry manually, then rebuild snapshots for this business date.',
            suggestedAction: {
              action: 'reprocess_attachment',
              endpoint: `/api/inbox/process/${emailId}`,
              description:
                'POST to reprocess this email and extract Basis categories (Dranken hoog/laag, Keuken)',
            },
          }),
      detectedAt: new Date().toISOString(),
      meta: {
        attachmentId: attId,
        emailId,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        retryAttempted: true,
        retrySucceeded: isFixed,
        retryAttachmentsProcessed: retry.attachmentsProcessed,
        retryAttachmentsFailed: retry.attachmentsFailed,
        retryError: retry.error,
      },
    })
  }

  return alerts
}
