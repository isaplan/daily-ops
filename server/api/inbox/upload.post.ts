import { Buffer } from 'node:buffer'
import { ensureInboxCollections, ensureInboxIndexes } from '../../utils/inbox/collections'
import { documentParserService } from '../../services/documentParserService'
import { dataMappingService } from '../../services/dataMappingService'
import { storeRawData, isTestDataType } from '../../services/rawDataStorageService'
import * as inboxRepo from '../../services/inboxRepository'
import type { DocumentType } from '~/types/inbox'

const MAX = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections()
    await ensureInboxIndexes()

    const form = await readMultipartFormData(event)
    const file = form?.find((f) => f.name === 'file' && f.data && f.filename)
    if (!file?.data || !file.filename) {
      return { success: false, error: 'No file provided' }
    }
    if (file.data.length > MAX) {
      return { success: false, error: 'File size exceeds 10MB limit' }
    }

    const buffer = Buffer.from(file.data)
    const mime = file.type || 'application/octet-stream'
    const isCsv = mime.includes('csv') || file.filename.toLowerCase().endsWith('.csv')
    const originalData = isCsv ? buffer.toString('utf-8') : buffer.toString('base64')

    const parseResult = await documentParserService.parseDocument({
      fileName: file.filename,
      mimeType: mime,
      data: isCsv ? buffer.toString('utf-8') : buffer,
      autoDetectType: true,
    })

    if (!parseResult.success) {
      const manualMessageId = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`
      const { _id: emailId } = await inboxRepo.insertEmail(
        {
          messageId: manualMessageId,
          from: 'manual_upload@system',
          subject: `Manual Upload: ${file.filename}`,
          receivedAt: new Date(),
          hasAttachments: true,
          attachmentCount: 1,
          summary: `Manually uploaded file: ${file.filename} (parse failed)`,
        },
        { status: 'failed' },
      )

      const attachId = `manual_${Date.now()}`
      const failedAttachment = await inboxRepo.insertAttachment(
        emailId,
        {
          emailId: String(emailId),
          fileName: file.filename,
          mimeType: mime,
          fileSize: file.data.length,
          googleAttachmentId: attachId,
          metadata: { format: parseResult.format === 'html' ? 'unknown' : parseResult.format },
        },
        {
          parseStatus: 'failed',
          documentType: 'other',
          parseError: parseResult.error || 'Failed to parse file',
          originalData,
        },
      )

      return {
        success: true,
        data: {
          email: { _id: String(emailId), messageId: manualMessageId, subject: `Manual Upload: ${file.filename}` },
          attachment: { _id: String(failedAttachment._id) },
          parseFailed: true,
          error: parseResult.error,
        },
      }
    }

    const manualMessageIdOk = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const { _id: emailId } = await inboxRepo.insertEmail({
      messageId: manualMessageIdOk,
      from: 'manual_upload@system',
      subject: `Manual Upload: ${file.filename}`,
      receivedAt: new Date(),
      hasAttachments: true,
      attachmentCount: 1,
      summary: `Manually uploaded file: ${file.filename}`,
    })

    const docType = parseResult.documentType ?? 'other'

    const attachIdOk = `manual_${Date.now()}`
    const attachmentIns = await inboxRepo.insertAttachment(
      emailId,
      {
        emailId: String(emailId),
        fileName: file.filename,
        mimeType: mime,
        fileSize: file.data.length,
        googleAttachmentId: attachIdOk,
        documentType: docType as DocumentType,
        metadata: {
          format: parseResult.format,
          sheets: parseResult.metadata?.sheets,
          delimiter: parseResult.metadata?.delimiter,
          rowCount: parseResult.rowCount,
          columnCount: parseResult.headers.length,
          userInfo: parseResult.metadata?.userInfo,
        },
      },
      { parseStatus: 'success', originalData, documentType: docType as DocumentType },
    )

    const parsedInsert = await inboxRepo.insertParsedData({
      attachmentId: String(attachmentIns._id),
      emailId: String(emailId),
      documentType: docType as DocumentType,
      format: parseResult.format === 'html' ? 'unknown' : parseResult.format,
      rowsProcessed: parseResult.rowCount,
      rowsValid: parseResult.rowCount,
      rowsFailed: 0,
      data: {
        headers: parseResult.headers,
        rows: parseResult.rows,
        metadata: parseResult.metadata,
      },
    })

    await inboxRepo.updateAttachment(String(attachmentIns._id), {
      parsedDataRef: parsedInsert._id,
    })

    let mappingResult: Record<string, unknown> | null = null

    if (parseResult.documentType && isTestDataType(parseResult.documentType)) {
      const rawStorageResult = await storeRawData(
        {
          attachmentId: String(attachmentIns._id),
          emailId: String(emailId),
          documentType: parseResult.documentType,
          format: parseResult.format === 'html' ? 'unknown' : parseResult.format,
          rowsProcessed: parseResult.rowCount,
          rowsValid: parseResult.rowCount,
          rowsFailed: 0,
          data: {
            headers: parseResult.headers,
            rows: parseResult.rows,
            metadata: parseResult.metadata,
          },
        },
        parseResult.documentType,
        { fileName: file.filename },
      )
      mappingResult = {
        success: rawStorageResult.recordsCreated > 0,
        mappedToCollection: rawStorageResult.collectionName,
        matchedRecords: 0,
        createdRecords: rawStorageResult.recordsCreated,
        updatedRecords: 0,
        failedRecords: rawStorageResult.recordsFailed,
        errors: rawStorageResult.errors,
      }
      await inboxRepo.updateParsedData(String(parsedInsert._id), {
        mapping: {
          mappedToCollection: rawStorageResult.collectionName,
          matchedRecords: 0,
          createdRecords: rawStorageResult.recordsCreated,
          updatedRecords: 0,
        },
        rowsValid: rawStorageResult.recordsCreated,
        rowsFailed: rawStorageResult.recordsFailed,
      })
    } else if (
      parseResult.documentType &&
      parseResult.documentType !== 'formitabele' &&
      parseResult.documentType !== 'pasy' &&
      parseResult.documentType !== 'coming_soon'
    ) {
      const mr = await dataMappingService.mapToCollection(
        {
          attachmentId: String(attachmentIns._id),
          emailId: String(emailId),
          documentType: parseResult.documentType,
          format: parseResult.format === 'html' ? 'unknown' : parseResult.format,
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
      mappingResult = {
        success: mr.success,
        mappedToCollection: mr.mappedToCollection,
        matchedRecords: mr.matchedRecords,
        createdRecords: mr.createdRecords,
        updatedRecords: mr.updatedRecords,
        failedRecords: mr.failedRecords,
        errors: mr.errors,
      }
      await inboxRepo.updateParsedData(String(parsedInsert._id), {
        mapping: {
          mappedToCollection: mr.mappedToCollection,
          matchedRecords: mr.matchedRecords,
          createdRecords: mr.createdRecords,
          updatedRecords: mr.updatedRecords,
        },
        rowsValid: mr.createdRecords + mr.updatedRecords,
        rowsFailed: mr.failedRecords,
      })
    }

    await inboxRepo.updateEmail(String(emailId), { status: 'completed', processedAt: new Date() })

    return {
      success: true,
      data: {
        email: {
          _id: String(emailId),
          messageId: manualMessageIdOk,
          subject: `Manual Upload: ${file.filename}`,
        },
        attachment: {
          _id: String(attachmentIns._id),
          fileName: file.filename,
          documentType: docType,
        },
        parseResult: {
          format: parseResult.format,
          headers: parseResult.headers,
          rowCount: parseResult.rowCount,
          documentType: parseResult.documentType,
        },
        mappingResult,
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to upload file',
    })
  }
})
