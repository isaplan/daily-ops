/**
 * @registry-id: inboxUploadAPI
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox upload API - manual file upload and parsing
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/documentParserService.ts => Document parsing
 *   - app/lib/services/dataMappingService.ts => Data mapping
 *   - app/models/InboxEmail.ts => InboxEmail model
 *   - app/models/EmailAttachment.ts => EmailAttachment model
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/upload/page.tsx => Manual file upload
 */

import { NextRequest, NextResponse } from 'next/server'
import { ensureInboxCollections } from '@/lib/mongodb/inbox-collections'
import { documentParserService } from '@/lib/services/documentParserService'
import { dataMappingService } from '@/lib/services/dataMappingService'
import { storeRawData, isTestDataType } from '@/lib/services/rawDataStorageService'
import InboxEmail from '@/models/InboxEmail'
import EmailAttachment from '@/models/EmailAttachment'
import ParsedData from '@/models/ParsedData'
import dbConnect from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    await ensureInboxCollections()

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse document
    const parseResult = await documentParserService.parseDocument({
      fileName: file.name,
      mimeType: file.type,
      data: file.type.includes('csv') ? buffer.toString('utf-8') : buffer,
      autoDetectType: true,
    })

    const isCsv = file.type.includes('csv') || (parseResult.format === 'csv')
    const originalData = isCsv ? buffer.toString('utf-8') : buffer.toString('base64')

    if (!parseResult.success) {
      // Still create email + attachment with originalData so user can Re-parse later
      const email = await InboxEmail.create({
        messageId: `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        from: 'manual_upload@system',
        subject: `Manual Upload: ${file.name}`,
        receivedAt: new Date(),
        hasAttachments: true,
        attachmentCount: 1,
        summary: `Manually uploaded file: ${file.name} (parse failed)`,
        status: 'failed',
      })
      const failedAttachment = await EmailAttachment.create({
        emailId: email._id,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        googleAttachmentId: `manual_${Date.now()}`,
        documentType: 'other',
        parseStatus: 'failed',
        parseError: parseResult.error || 'Failed to parse file',
        originalData,
        metadata: { format: parseResult.format || 'unknown' },
      })
      return NextResponse.json({
        success: true,
        data: {
          email: { _id: email._id.toString(), messageId: email.messageId, subject: email.subject },
          attachment: { _id: failedAttachment._id.toString() },
          parseFailed: true,
          error: parseResult.error,
        },
      })
    }

    // Create email record (manual upload)
    const email = await InboxEmail.create({
      messageId: `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      from: 'manual_upload@system',
      subject: `Manual Upload: ${file.name}`,
      receivedAt: new Date(),
      hasAttachments: true,
      attachmentCount: 1,
      summary: `Manually uploaded file: ${file.name}`,
      status: 'completed',
    })

    // Create attachment record (with originalData for re-parse)
    const attachment = await EmailAttachment.create({
      emailId: email._id,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      googleAttachmentId: `manual_${Date.now()}`,
      documentType: parseResult.documentType || 'other',
      parseStatus: 'success',
      originalData,
      metadata: {
        format: parseResult.format,
        sheets: parseResult.metadata?.sheets,
        delimiter: parseResult.metadata?.delimiter,
        rowCount: parseResult.rowCount,
        columnCount: parseResult.headers.length,
        userInfo: parseResult.metadata?.userInfo,
      },
    })

    // Create parsed data record
    const parsedData = await ParsedData.create({
      attachmentId: attachment._id,
      emailId: email._id,
      documentType: parseResult.documentType || 'other',
      format: parseResult.format,
      rowsProcessed: parseResult.rowCount,
      rowsValid: parseResult.rowCount,
      rowsFailed: 0,
      data: {
        headers: parseResult.headers,
        rows: parseResult.rows,
        metadata: parseResult.metadata,
      },
    })

    // Link parsed data to attachment
    attachment.parsedDataRef = parsedData._id
    await attachment.save()

    // Bork test types (sales, product_mix, etc.): store raw rows in test-bork-* so view shows data
    let mappingResult = null
    if (parseResult.documentType && isTestDataType(parseResult.documentType)) {
      const rawStorageResult = await storeRawData(
        {
          attachmentId: attachment._id.toString(),
          emailId: email._id.toString(),
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
        },
        parseResult.documentType,
        { fileName: attachment.fileName }
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
      parsedData.mapping = {
        mappedToCollection: rawStorageResult.collectionName,
        matchedRecords: 0,
        createdRecords: rawStorageResult.recordsCreated,
        updatedRecords: 0,
      }
      parsedData.rowsValid = rawStorageResult.recordsCreated
      parsedData.rowsFailed = rawStorageResult.recordsFailed
      await parsedData.save()
    } else if (
      parseResult.documentType &&
      parseResult.documentType !== 'formitabele' &&
      parseResult.documentType !== 'pasy' &&
      parseResult.documentType !== 'coming_soon'
    ) {
      // Map to collection for non–test types (Eitje hours, contracts, etc.)
      mappingResult = await dataMappingService.mapToCollection(
        {
          attachmentId: attachment._id.toString(),
          emailId: email._id.toString(),
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
        parseResult.documentType
      )

      parsedData.mapping = {
        mappedToCollection: mappingResult.mappedToCollection,
        matchedRecords: mappingResult.matchedRecords,
        createdRecords: mappingResult.createdRecords,
        updatedRecords: mappingResult.updatedRecords,
      }
      parsedData.rowsValid = mappingResult.createdRecords + mappingResult.updatedRecords
      parsedData.rowsFailed = mappingResult.failedRecords
      await parsedData.save()
    }

    return NextResponse.json({
      success: true,
      data: {
        email: {
          _id: email._id.toString(),
          messageId: email.messageId,
          subject: email.subject,
        },
        attachment: {
          _id: attachment._id.toString(),
          fileName: attachment.fileName,
          documentType: attachment.documentType,
        },
        parseResult: {
          format: parseResult.format,
          headers: parseResult.headers,
          rowCount: parseResult.rowCount,
          documentType: parseResult.documentType,
        },
        mappingResult,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
      },
      { status: 500 }
    )
  }
}
