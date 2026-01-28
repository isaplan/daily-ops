/**
 * @registry-id: inboxProcessAPI
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-27T00:00:00.000Z
 * @description: Inbox process API - parse attachments and map data to collections
 * @last-fix: [2026-01-27] Added raw data storage for test data types (sales, product_mix, food_beverage, basis_report, product_sales_per_hour)
 * 
 * @imports-from:
 *   - app/lib/services/documentParserService.ts => Document parsing
 *   - app/lib/services/dataMappingService.ts => Data mapping
 *   - app/lib/services/rawDataStorageService.ts => Raw data storage for test types
 *   - app/lib/services/gmailApiService.ts => Download attachments
 *   - app/models/EmailAttachment.ts => EmailAttachment model
 *   - app/models/ParsedData.ts => ParsedData model
 *   - app/models/ProcessingLog.ts => ProcessingLog model
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/[emailId]/page.tsx => Triggers processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { ensureInboxCollections } from '@/lib/mongodb/inbox-collections'
import { documentParserService } from '@/lib/services/documentParserService'
import { dataMappingService } from '@/lib/services/dataMappingService'
import { storeRawData, updateSourceFileName, isTestDataType } from '@/lib/services/rawDataStorageService'
import { gmailApiService } from '@/lib/services/gmailApiService'
import InboxEmail from '@/models/InboxEmail'
import EmailAttachment from '@/models/EmailAttachment'
import ParsedData from '@/models/ParsedData'
import ProcessingLog from '@/models/ProcessingLog'
import dbConnect from '@/lib/mongodb'
import { Buffer } from 'buffer'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    await dbConnect()
    await ensureInboxCollections()

    const { emailId } = await params

    // Get email
    const email = await InboxEmail.findById(emailId)
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 }
      )
    }

    // Update status
    email.status = 'processing'
    email.lastAttempt = new Date()
    await email.save()

    // Get attachments
    const attachments = await EmailAttachment.find({ emailId, parseStatus: { $ne: 'success' } })

    let attachmentsProcessed = 0
    let attachmentsFailed = 0

    for (const attachment of attachments) {
      try {
        // Update attachment status
        attachment.parseStatus = 'parsing'
        await attachment.save()

        // Download attachment from Gmail
        const gmailAttachment = await gmailApiService.downloadAttachment(
          email.messageId,
          attachment.googleAttachmentId
        )

        if (!gmailAttachment.data) {
          throw new Error('Failed to download attachment data')
        }

        // Decode base64
        const fileBuffer = Buffer.from(gmailAttachment.data, 'base64')

        // Parse document
        const parseResult = await documentParserService.parseDocument({
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          data: attachment.mimeType.includes('csv')
            ? fileBuffer.toString('utf-8')
            : fileBuffer,
          autoDetectType: true,
        })

        if (!parseResult.success || !parseResult.documentType) {
          attachment.parseStatus = 'failed'
          attachment.parseError = parseResult.error || 'Parsing failed'
          await attachment.save()

          await ProcessingLog.create({
            emailId: email._id,
            attachmentId: attachment._id,
            eventType: 'parse',
            status: 'error',
            message: `Failed to parse attachment: ${parseResult.error}`,
          })

          attachmentsFailed++
          continue
        }

        // Update attachment with parse metadata
        attachment.documentType = parseResult.documentType
        attachment.metadata = {
          ...attachment.metadata,
          format: parseResult.format,
          sheets: parseResult.metadata?.sheets,
          delimiter: parseResult.metadata?.delimiter,
          rowCount: parseResult.rowCount,
          columnCount: parseResult.headers.length,
          userInfo: parseResult.metadata?.userInfo,
        }
        await attachment.save()

        // Create parsed data record
        const parsedData = await ParsedData.create({
          attachmentId: attachment._id,
          emailId: email._id,
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
        })

        // Link parsed data to attachment
        attachment.parsedDataRef = parsedData._id

        // Check if this is a test data type (raw storage) or regular type (mapped storage)
        if (isTestDataType(parseResult.documentType)) {
          // Store raw data without transformations
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
            {
              fileName: attachment.fileName,
            }
          )

          // Update parsed data with storage results
          parsedData.mapping = {
            mappedToCollection: rawStorageResult.collectionName,
            matchedRecords: 0,
            createdRecords: rawStorageResult.recordsCreated,
            updatedRecords: 0,
          }
          parsedData.rowsValid = rawStorageResult.recordsCreated
          parsedData.rowsFailed = rawStorageResult.recordsFailed
          parsedData.validationErrors = rawStorageResult.errors.map((e) => ({
            row: e.row,
            column: '',
            error: e.error,
          }))
          await parsedData.save()
        } else if (
          parseResult.documentType !== 'formitabele' &&
          parseResult.documentType !== 'pasy' &&
          parseResult.documentType !== 'coming_soon'
        ) {
          // Map to collection using dataMappingService (regular types)
          const mappingResult = await dataMappingService.mapToCollection(
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

          // Update parsed data with mapping results
          parsedData.mapping = {
            mappedToCollection: mappingResult.mappedToCollection,
            matchedRecords: mappingResult.matchedRecords,
            createdRecords: mappingResult.createdRecords,
            updatedRecords: mappingResult.updatedRecords,
          }
          parsedData.rowsValid = mappingResult.createdRecords + mappingResult.updatedRecords
          parsedData.rowsFailed = mappingResult.failedRecords
          parsedData.validationErrors = mappingResult.errors.map((e) => ({
            row: e.row,
            column: '',
            error: e.error,
          }))
          await parsedData.save()
        }

        // Update attachment status
        attachment.parseStatus = 'success'
        await attachment.save()

        await ProcessingLog.create({
          emailId: email._id,
          attachmentId: attachment._id,
          eventType: 'store',
          status: 'success',
          message: `Successfully parsed and stored ${parseResult.rowCount} rows`,
        })

        attachmentsProcessed++
      } catch (error) {
        attachment.parseStatus = 'failed'
        attachment.parseError = error instanceof Error ? error.message : 'Unknown error'
        await attachment.save()

        await ProcessingLog.create({
          emailId: email._id,
          attachmentId: attachment._id,
          eventType: 'error',
          status: 'error',
          message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })

        attachmentsFailed++
      }
    }

    // Update email status
    email.status = attachmentsFailed === 0 ? 'completed' : 'failed'
    email.processedAt = new Date()
    await email.save()

    return NextResponse.json({
      success: true,
      data: {
        success: attachmentsFailed === 0,
        attachmentsProcessed,
        attachmentsFailed,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process email',
      },
      { status: 500 }
    )
  }
}
