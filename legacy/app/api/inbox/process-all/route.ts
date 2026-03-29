/**
 * @registry-id: inboxProcessAllAPI
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-02-02T12:00:00.000Z
 * @description: Process all unprocessed emails - batch process all emails with unprocessed attachments
 * @last-fix: [2026-02-02] Added data.message for clear UI feedback when 0 processed
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import { ensureInboxCollections } from '@/lib/mongodb/inbox-collections'
import { documentParserService } from '@/lib/services/documentParserService'
import { dataMappingService } from '@/lib/services/dataMappingService'
import { storeRawData, isTestDataType } from '@/lib/services/rawDataStorageService'
import { gmailApiService } from '@/lib/services/gmailApiService'
import InboxEmail from '@/models/InboxEmail'
import EmailAttachment from '@/models/EmailAttachment'
import ParsedData from '@/models/ParsedData'
import ProcessingLog from '@/models/ProcessingLog'
import { Buffer } from 'buffer'

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    await ensureInboxCollections()

    const body = await request.json().catch(() => ({}))
    const maxEmails = body.maxEmails || 50

    // Find all emails with unprocessed attachments
    const emails = await InboxEmail.find({
      $or: [
        { status: { $ne: 'completed' } },
        { status: { $exists: false } },
      ],
    })
      .sort({ receivedAt: -1 })
      .limit(maxEmails)

    let totalProcessed = 0
    let totalFailed = 0
    const results: Array<{ emailId: string; success: boolean; attachmentsProcessed: number; error?: string }> = []

    for (const email of emails) {
      try {
        // Check if email has unprocessed attachments
        const unprocessedAttachments = await EmailAttachment.find({
          emailId: email._id,
          parseStatus: { $ne: 'success' },
        })

        if (unprocessedAttachments.length === 0) {
          // Mark email as completed if no unprocessed attachments
          email.status = 'completed'
          await email.save()
          continue
        }

        // Update email status
        email.status = 'processing'
        email.lastAttempt = new Date()
        await email.save()

        let attachmentsProcessed = 0
        let attachmentsFailed = 0

        // Process each attachment
        for (const attachment of unprocessedAttachments) {
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
            const lowerName = attachment.fileName.toLowerCase()
            const lowerMime = attachment.mimeType.toLowerCase()
            const isHtml =
              lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerMime.includes('text/html')
            if (isHtml) {
              attachment.parseStatus = 'success'
              attachment.documentType = 'other'
              attachment.metadata = { ...attachment.metadata, format: 'unknown' }
              attachment.parseError = undefined
              await attachment.save()
              attachmentsProcessed++
              continue
            }
            // Parser expects CSV as string; Gmail often sends CSV as text/plain or application/octet-stream
            const isCsvByMimeOrExt =
              lowerMime.includes('csv') || lowerName.endsWith('.csv')

            // Parse document
            const parseResult = await documentParserService.parseDocument({
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              data: isCsvByMimeOrExt ? fileBuffer.toString('utf-8') : fileBuffer,
              autoDetectType: true,
            })

            if (!parseResult.success || !parseResult.documentType) {
              attachment.parseStatus = 'failed'
              attachment.parseError = parseResult.error || 'Parsing failed'
              await attachment.save()
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

        if (attachmentsProcessed > 0) {
          totalProcessed++
          results.push({
            emailId: email._id.toString(),
            success: attachmentsFailed === 0,
            attachmentsProcessed,
          })
        } else {
          totalFailed++
          results.push({
            emailId: email._id.toString(),
            success: false,
            attachmentsProcessed: 0,
            error: 'No attachments processed',
          })
        }
      } catch (error) {
        totalFailed++
        results.push({
          emailId: email._id.toString(),
          success: false,
          attachmentsProcessed: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const total = emails.length
    let message: string
    if (total === 0) {
      message = 'No emails to process. Sync inbox first to fetch emails, or all emails are already completed.'
    } else if (totalProcessed === 0 && totalFailed === 0) {
      message = 'No unprocessed attachments found. All checked emails are already up to date.'
    } else if (totalProcessed === 0 && totalFailed > 0) {
      message = `No attachments could be processed. ${totalFailed} email(s) had errors.`
    } else if (totalFailed > 0) {
      message = `${totalProcessed} email(s) processed, ${totalFailed} failed.`
    } else {
      message = `Processed ${totalProcessed} email(s) successfully.`
    }

    return NextResponse.json({
      success: true,
      data: {
        emailsProcessed: totalProcessed,
        emailsFailed: totalFailed,
        total,
        message,
        results,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process all emails',
      },
      { status: 500 }
    )
  }
}
