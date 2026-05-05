/**
 * @registry-id: inboxProcessService
 * @created: 2026-04-18T00:00:00.000Z
 * @last-modified: 2026-04-24T00:00:00.000Z
 * @description: Parse Gmail/manual attachments, map to collections (from next-js-old process routes)
 * @last-fix: [2026-04-24] Aggregate daily sales after mapping + location extraction
 *
 * @exports-to:
 * ✓ server/api/inbox/process/[emailId].post.ts
 * ✓ server/api/inbox/process-all.post.ts
 * ✓ server/services/inboxWebhookService.ts
 * ✓ server/api/inbox/sync.post.ts
 */

import { ObjectId } from 'mongodb'
import { documentParserService } from './documentParserService'
import { dataMappingService } from './dataMappingService'
import { storeRawData, isTestDataType, updateSourceFileName } from './rawDataStorageService'
import { gmailApiService } from './gmailApiService'
import { aggregateDailySalesForEmail } from './borkSalesDailyAggregation'
import { mapBasisReportXLSX } from '../utils/inbox/basis-report-mapper'
import { getDb } from '../utils/db'
import * as inboxRepo from './inboxRepository'
import type { CreateParsedDataDto, DocumentType, EmailAttachmentDoc, FileFormat } from '~/types/inbox'
import { Buffer } from 'node:buffer'

async function handleParsedMapping(
  parseResult: {
    success: boolean
    documentType?: DocumentType
    format: FileFormat
    headers: string[]
    rows: Record<string, unknown>[]
    rowCount: number
    metadata?: Record<string, unknown>
  },
  attachmentId: string,
  emailId: string,
  parsedDataId: ObjectId,
): Promise<void> {
  if (!parseResult.documentType) return

  const base: CreateParsedDataDto = {
    attachmentId,
    emailId,
    documentType: parseResult.documentType,
    format: parseResult.format,
    rowsProcessed: parseResult.rowCount,
    rowsValid: parseResult.rowCount,
    rowsFailed: 0,
    data: {
      headers: parseResult.headers,
      rows: parseResult.rows,
      metadata: parseResult.metadata,
    },
  }

  if (isTestDataType(parseResult.documentType)) {
    const rawStorageResult = await storeRawData(base, parseResult.documentType, {})
    await inboxRepo.updateParsedData(String(parsedDataId), {
      mapping: {
        mappedToCollection: rawStorageResult.collectionName,
        matchedRecords: 0,
        createdRecords: rawStorageResult.recordsCreated,
        updatedRecords: 0,
      },
      rowsValid: rawStorageResult.recordsCreated,
      rowsFailed: rawStorageResult.recordsFailed,
      validationErrors: rawStorageResult.errors.map((e) => ({
        row: e.row,
        column: '',
        error: e.error,
      })),
    })
  } else if (
    parseResult.documentType !== 'formitabele' &&
    parseResult.documentType !== 'pasy' &&
    parseResult.documentType !== 'coming_soon'
  ) {
    // Special handling for basis_report (Bork daily sales)
    if (parseResult.documentType === 'basis_report' || parseResult.format === 'xlsx') {
      try {
        console.log('[handleParsedMapping] Processing basis_report, documentType:', parseResult.documentType, 'format:', parseResult.format)
        const basisReport = mapBasisReportXLSX(parseResult, '')
        if (basisReport) {
          // Store structured sales report
          const db = await getDb()
          await db
            .collection('basis_reports')
            .updateOne(
              { date: basisReport.date, location: basisReport.location },
              { $set: basisReport },
              { upsert: true },
            )
          
          await inboxRepo.updateParsedData(String(parsedDataId), {
            mapping: {
              mappedToCollection: 'basis_reports',
              matchedRecords: 1,
              createdRecords: 1,
              updatedRecords: 0,
            },
            rowsValid: 1,
            rowsFailed: 0,
          })
          console.log('[handleParsedMapping] Stored basis report:', basisReport.date, basisReport.location)
        } else {
          console.log('[handleParsedMapping] Mapper returned null')
        }
      } catch (err) {
        console.error('[handleParsedMapping] Basis report error:', err instanceof Error ? err.message : err)
        throw err
      }
    } else {
      const mappingResult = await dataMappingService.mapToCollection(
        {
          ...base,
          data: { headers: parseResult.headers, rows: parseResult.rows },
        },
        parseResult.documentType,
      )
      await inboxRepo.updateParsedData(String(parsedDataId), {
        mapping: {
          mappedToCollection: mappingResult.mappedToCollection,
          matchedRecords: mappingResult.matchedRecords,
          createdRecords: mappingResult.createdRecords,
          updatedRecords: mappingResult.updatedRecords,
        },
        rowsValid: mappingResult.createdRecords + mappingResult.updatedRecords,
        rowsFailed: mappingResult.failedRecords,
        validationErrors: mappingResult.errors.map((e) => ({
          row: e.row,
          column: '',
          error: e.error,
        })),
      })

      // Aggregate daily sales if this is a sales document
      if (parseResult.documentType === 'sales') {
        try {
          const emailOid = new ObjectId(emailId)
          await aggregateDailySalesForEmail(emailOid)
        } catch (error) {
          console.error('[inboxProcessService] Failed to aggregate daily sales:', error)
        }
      }
    }
  }
}

export async function processEmailAttachments(emailId: string): Promise<{
  success: boolean
  attachmentsProcessed: number
  attachmentsFailed: number
}> {
  const email = await inboxRepo.getEmailDocById(emailId)
  if (!email) {
    throw new Error('Email not found')
  }

  const messageId = String(email.messageId)
  const eid = email._id as ObjectId

  await inboxRepo.updateEmail(emailId, {
    status: 'processing',
    lastAttempt: new Date(),
  })

  const attachments = await inboxRepo.findAttachmentsByEmail(eid, { parseStatus: { $ne: 'success' } })

  let attachmentsProcessed = 0
  let attachmentsFailed = 0

  for (const attachment of attachments) {
    const attId = String(attachment._id)
    try {
      await inboxRepo.updateAttachment(attId, { parseStatus: 'parsing' })

      const lowerName = String(attachment.fileName ?? '').toLowerCase()
      const lowerMime = String(attachment.mimeType ?? '').toLowerCase()
      const isHtml =
        lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerMime.includes('text/html')
      if (isHtml) {
        await inboxRepo.updateAttachment(attId, {
          parseStatus: 'success',
          documentType: 'other',
          metadata: {
            ...(attachment.metadata as Record<string, unknown>),
            format: 'unknown',
          } as EmailAttachmentDoc['metadata'],
        })
        attachmentsProcessed++
        continue
      }

      let parseData: string | Buffer
      const isCsv =
        lowerMime.includes('csv') || lowerName.endsWith('.csv')

      const originalData = attachment.originalData != null ? String(attachment.originalData) : undefined

      if (originalData) {
        parseData = isCsv ? originalData : Buffer.from(originalData, 'base64')
      } else {
        const gmailAttachment = await gmailApiService.downloadAttachment(
          messageId,
          String(attachment.googleAttachmentId),
        )
        if (!gmailAttachment.data) {
          throw new Error('Failed to download attachment data')
        }
        const fileBuffer = Buffer.from(gmailAttachment.data, 'base64')
        parseData = isCsv ? fileBuffer.toString('utf-8') : fileBuffer
        await inboxRepo.updateAttachment(attId, {
          originalData: isCsv ? (parseData as string) : fileBuffer.toString('base64'),
        })
      }

      const parseResult = await documentParserService.parseDocument({
        fileName: String(attachment.fileName),
        mimeType: String(attachment.mimeType),
        data: parseData,
        autoDetectType: true,
      })

      if (!parseResult.success || !parseResult.documentType) {
        await inboxRepo.updateAttachment(attId, {
          parseStatus: 'failed',
          parseError: parseResult.error || 'Parsing failed',
        })
        await inboxRepo.insertProcessingLog({
          emailId,
          attachmentId: attId,
          eventType: 'parse',
          status: 'error',
          message: `Failed to parse attachment: ${parseResult.error}`,
        })
        attachmentsFailed++
        continue
      }

      const meta = (attachment.metadata ?? {}) as Record<string, unknown>
      await inboxRepo.updateAttachment(attId, {
        documentType: parseResult.documentType,
        metadata: {
          format: parseResult.format,
          sheets: (parseResult.metadata as { sheets?: string[] })?.sheets,
          delimiter: (parseResult.metadata as { delimiter?: string })?.delimiter,
          rowCount: parseResult.rowCount,
          columnCount: parseResult.headers.length,
          userInfo: (parseResult.metadata as { userInfo?: Record<string, unknown> })?.userInfo,
          ...meta,
        } as EmailAttachmentDoc['metadata'],
      })

      const parsedInsert = await inboxRepo.insertParsedData({
        attachmentId: attId,
        emailId,
        documentType: parseResult.documentType,
        format: parseResult.format,
        rowsProcessed: parseResult.rowCount,
        rowsValid: parseResult.rowCount,
        rowsFailed: 0,
        data: {
          headers: parseResult.headers,
          rows: parseResult.rows,
          metadata: parseResult.metadata as Record<string, unknown>,
        },
      })

      await inboxRepo.updateAttachment(attId, { parsedDataRef: parsedInsert._id })

      await handleParsedMapping(parseResult, attId, emailId, parsedInsert._id)

      await inboxRepo.updateAttachment(attId, { parseStatus: 'success' })

      await inboxRepo.insertProcessingLog({
        emailId,
        attachmentId: attId,
        eventType: 'store',
        status: 'success',
        message: `Successfully parsed and stored ${parseResult.rowCount} rows`,
      })

      attachmentsProcessed++
    } catch (error) {
      await inboxRepo.updateAttachment(attId, {
        parseStatus: 'failed',
        parseError: error instanceof Error ? error.message : 'Unknown error',
      })
      await inboxRepo.insertProcessingLog({
        emailId,
        attachmentId: attId,
        eventType: 'error',
        status: 'error',
        message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
      attachmentsFailed++
    }
  }

  await inboxRepo.updateEmail(emailId, {
    status: attachmentsFailed === 0 ? 'completed' : 'failed',
    processedAt: new Date(),
  })

  return {
    success: attachmentsFailed === 0,
    attachmentsProcessed,
    attachmentsFailed,
  }
}

export async function processAllUnprocessed(maxEmails: number): Promise<{
  emailsProcessed: number
  emailsFailed: number
  total: number
  message: string
  results: Array<{ emailId: string; success: boolean; attachmentsProcessed: number; error?: string }>
}> {
  const { getDb } = await import('../utils/db')
  const { INBOX_COLLECTIONS } = await import('../utils/inbox/constants')
  const db = await getDb()
  const col = db.collection(INBOX_COLLECTIONS.inboxEmail)

  const emails = await col
    .find({
      $or: [{ status: { $ne: 'completed' } }, { status: { $exists: false } }],
    })
    .sort({ receivedAt: -1 })
    .limit(maxEmails)
    .toArray()

  let totalProcessed = 0
  let totalFailed = 0
  const results: Array<{ emailId: string; success: boolean; attachmentsProcessed: number; error?: string }> = []

  for (const email of emails) {
    const emailIdStr = String(email._id)
    const unprocessed = await inboxRepo.findAttachmentsByEmail(email._id as ObjectId, {
      parseStatus: { $ne: 'success' },
    })

    if (unprocessed.length === 0) {
      await inboxRepo.updateEmail(emailIdStr, { status: 'completed' })
      continue
    }

    const messageId = String(email.messageId)
    await inboxRepo.updateEmail(emailIdStr, { status: 'processing', lastAttempt: new Date() })

    let attachmentsProcessed = 0
    let attachmentsFailed = 0

    for (const attachment of unprocessed) {
      const attId = String(attachment._id)
      try {
        await inboxRepo.updateAttachment(attId, { parseStatus: 'parsing' })

        const gmailAttachment = await gmailApiService.downloadAttachment(
          messageId,
          String(attachment.googleAttachmentId),
        )
        if (!gmailAttachment.data) {
          throw new Error('Failed to download attachment data')
        }

        const fileBuffer = Buffer.from(gmailAttachment.data, 'base64')
        const lowerName = String(attachment.fileName).toLowerCase()
        const lowerMime = String(attachment.mimeType).toLowerCase()
        const isHtml =
          lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerMime.includes('text/html')
        if (isHtml) {
          await inboxRepo.updateAttachment(attId, {
            parseStatus: 'success',
            documentType: 'other',
            metadata: { ...(attachment.metadata as object), format: 'unknown' } as EmailAttachmentDoc['metadata'],
          })
          attachmentsProcessed++
          continue
        }

        const isCsvByMimeOrExt = lowerMime.includes('csv') || lowerName.endsWith('.csv')

        const parseResult = await documentParserService.parseDocument({
          fileName: String(attachment.fileName),
          mimeType: String(attachment.mimeType),
          data: isCsvByMimeOrExt ? fileBuffer.toString('utf-8') : fileBuffer,
          autoDetectType: true,
        })

        if (!parseResult.success || !parseResult.documentType) {
          await inboxRepo.updateAttachment(attId, {
            parseStatus: 'failed',
            parseError: parseResult.error || 'Parsing failed',
          })
          attachmentsFailed++
          continue
        }

        const meta = (attachment.metadata ?? {}) as Record<string, unknown>
        await inboxRepo.updateAttachment(attId, {
          documentType: parseResult.documentType,
          metadata: {
            format: parseResult.format,
            sheets: (parseResult.metadata as { sheets?: string[] })?.sheets,
            delimiter: (parseResult.metadata as { delimiter?: string })?.delimiter,
            rowCount: parseResult.rowCount,
            columnCount: parseResult.headers.length,
            userInfo: (parseResult.metadata as { userInfo?: Record<string, unknown> })?.userInfo,
            ...meta,
          } as EmailAttachmentDoc['metadata'],
        })

        const parsedInsert = await inboxRepo.insertParsedData({
          attachmentId: attId,
          emailId: emailIdStr,
          documentType: parseResult.documentType,
          format: parseResult.format,
          rowsProcessed: parseResult.rowCount,
          rowsValid: parseResult.rowCount,
          rowsFailed: 0,
          data: {
            headers: parseResult.headers,
            rows: parseResult.rows,
            metadata: parseResult.metadata as Record<string, unknown>,
          },
        })

        await inboxRepo.updateAttachment(attId, { parsedDataRef: parsedInsert._id })

        if (isTestDataType(parseResult.documentType)) {
          const rawStorageResult = await storeRawData(
            {
              attachmentId: attId,
              emailId: emailIdStr,
              documentType: parseResult.documentType,
              format: parseResult.format,
              rowsProcessed: parseResult.rowCount,
              rowsValid: parseResult.rowCount,
              rowsFailed: 0,
              data: {
                headers: parseResult.headers,
                rows: parseResult.rows,
                metadata: parseResult.metadata as Record<string, unknown>,
              },
            },
            parseResult.documentType,
            { fileName: String(attachment.fileName) },
          )
          await inboxRepo.updateParsedData(String(parsedInsert._id), {
            mapping: {
              mappedToCollection: rawStorageResult.collectionName,
              matchedRecords: 0,
              createdRecords: rawStorageResult.recordsCreated,
              updatedRecords: 0,
            },
            rowsValid: rawStorageResult.recordsCreated,
            rowsFailed: rawStorageResult.recordsFailed,
            validationErrors: rawStorageResult.errors.map((e) => ({
              row: e.row,
              column: '',
              error: e.error,
            })),
          })
        } else if (
          parseResult.documentType !== 'formitabele' &&
          parseResult.documentType !== 'pasy' &&
          parseResult.documentType !== 'coming_soon'
        ) {
          const mappingResult = await dataMappingService.mapToCollection(
            {
              attachmentId: attId,
              emailId: emailIdStr,
              documentType: parseResult.documentType,
              format: parseResult.format,
              rowsProcessed: parseResult.rowCount,
              rowsValid: parseResult.rowCount,
              rowsFailed: 0,
              data: {
                headers: parseResult.headers,
                rows: parseResult.rows,
              },
            },
            parseResult.documentType,
          )
          await inboxRepo.updateParsedData(String(parsedInsert._id), {
            mapping: {
              mappedToCollection: mappingResult.mappedToCollection,
              matchedRecords: mappingResult.matchedRecords,
              createdRecords: mappingResult.createdRecords,
              updatedRecords: mappingResult.updatedRecords,
            },
            rowsValid: mappingResult.createdRecords + mappingResult.updatedRecords,
            rowsFailed: mappingResult.failedRecords,
            validationErrors: mappingResult.errors.map((e) => ({
              row: e.row,
              column: '',
              error: e.error,
            })),
          })
        }

        await inboxRepo.updateAttachment(attId, { parseStatus: 'success' })

        await inboxRepo.insertProcessingLog({
          emailId: emailIdStr,
          attachmentId: attId,
          eventType: 'store',
          status: 'success',
          message: `Successfully parsed and stored ${parseResult.rowCount} rows`,
        })

        attachmentsProcessed++
      } catch (error) {
        await inboxRepo.updateAttachment(attId, {
          parseStatus: 'failed',
          parseError: error instanceof Error ? error.message : 'Unknown error',
        })
        await inboxRepo.insertProcessingLog({
          emailId: emailIdStr,
          attachmentId: attId,
          eventType: 'error',
          status: 'error',
          message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        attachmentsFailed++
      }
    }

    await inboxRepo.updateEmail(emailIdStr, {
      status: attachmentsFailed === 0 ? 'completed' : 'failed',
      processedAt: new Date(),
    })

    if (attachmentsProcessed > 0) {
      totalProcessed++
      results.push({
        emailId: emailIdStr,
        success: attachmentsFailed === 0,
        attachmentsProcessed,
      })
    } else {
      totalFailed++
      results.push({
        emailId: emailIdStr,
        success: false,
        attachmentsProcessed: 0,
        error: 'No attachments processed',
      })
    }
  }

  const total = emails.length
  let message: string
  if (total === 0) {
    message =
      'No emails to process. Sync inbox first to fetch emails, or all emails are already completed.'
  } else if (totalProcessed === 0 && totalFailed === 0) {
    message = 'No unprocessed attachments found. All checked emails are already up to date.'
  } else if (totalProcessed === 0 && totalFailed > 0) {
    message = `No attachments could be processed. ${totalFailed} email(s) had errors.`
  } else if (totalFailed > 0) {
    message = `${totalProcessed} email(s) processed, ${totalFailed} failed.`
  } else {
    message = `Processed ${totalProcessed} email(s) successfully.`
  }

  return {
    emailsProcessed: totalProcessed,
    emailsFailed: totalFailed,
    total,
    message,
    results,
  }
}
