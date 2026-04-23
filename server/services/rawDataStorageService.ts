/**
 * @registry-id: rawDataStorageService
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-04-23T00:00:00.000Z
 * @description: Raw parsed rows for Bork test document types (Nuxt port — native driver)
 * @last-fix: [2026-04-23] Canonical inbox sales rows (BSON date) for reportDate API filter
 *
 * @exports-to:
 * ✓ server/services/inboxProcessService.ts
 * ✓ server/api/inbox/upload.post.ts
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../utils/db'
import { canonicalInboxSalesRow } from '../utils/inbox/inbox-sales-row-canonical'
import type { DocumentType, CreateParsedDataDto } from '~/types/inbox'

export type RawStorageResult = {
  success: boolean
  collectionName: string
  recordsCreated: number
  recordsFailed: number
  errors: Array<{ row: number; error: string }>
}

export type StoreRawDataOptions = {
  fileName?: string
}

function getCollectionName(documentType: DocumentType): string {
  switch (documentType) {
    case 'sales':
      return 'inbox-bork-sales'
    case 'product_mix':
      return 'inbox-bork-product-mix'
    case 'food_beverage':
      return 'inbox-bork-food-beverage'
    case 'basis_report':
      return 'inbox-bork-basis-report'
    case 'product_sales_per_hour':
      return 'inbox-bork-basis-report'
    default:
      return 'unknown'
  }
}

export function isTestDataType(documentType: DocumentType): boolean {
  return ['sales', 'product_mix', 'food_beverage', 'basis_report', 'product_sales_per_hour'].includes(documentType)
}

export async function storeRawData(
  parsedData: CreateParsedDataDto,
  documentType: DocumentType,
  options?: StoreRawDataOptions,
): Promise<RawStorageResult> {
  if (!isTestDataType(documentType)) {
    return {
      success: false,
      collectionName: 'unknown',
      recordsCreated: 0,
      recordsFailed: parsedData.rowsProcessed,
      errors: [
        {
          row: 0,
          error: `Document type "${documentType}" is not a test data type`,
        },
      ],
    }
  }

  const collectionName = getCollectionName(documentType)
  const errors: Array<{ row: number; error: string }> = []
  let recordsCreated = 0

  try {
    const db = await getDb()
    const collection = db.collection(collectionName)
    const emailId = new ObjectId(parsedData.emailId)
    const attachmentId = new ObjectId(parsedData.attachmentId)

    const documentsToInsert = parsedData.data.rows
      .map((row, index) => {
        try {
          const baseRow = documentType === 'sales' ? canonicalInboxSalesRow(row) : row
          return {
            ...baseRow,
            sourceEmailId: emailId,
            sourceAttachmentId: attachmentId,
            sourceFileName: options?.fileName || '',
            fileFormat: parsedData.format,
            parsedAt: new Date(),
          }
        } catch (error) {
          errors.push({
            row: index + 1,
            error: error instanceof Error ? error.message : 'Unknown error creating document',
          })
          return null
        }
      })
      .filter((doc): doc is Record<string, unknown> => doc !== null)

    if (documentsToInsert.length > 0) {
      const result = await collection.insertMany(documentsToInsert, { ordered: false })
      recordsCreated = result.insertedCount
    }

    return {
      success: errors.length < parsedData.rowsProcessed,
      collectionName,
      recordsCreated,
      recordsFailed: errors.length,
      errors,
    }
  } catch (error) {
    return {
      success: false,
      collectionName,
      recordsCreated,
      recordsFailed: parsedData.rowsProcessed,
      errors: [
        {
          row: 0,
          error: error instanceof Error ? error.message : 'Unknown database error',
        },
      ],
    }
  }
}

export async function updateSourceFileName(
  documentType: DocumentType,
  attachmentId: string,
  fileName: string,
): Promise<void> {
  if (!isTestDataType(documentType)) {
    return
  }

  const collectionName = getCollectionName(documentType)
  const db = await getDb()
  const collection = db.collection(collectionName)

  try {
    await collection.updateMany(
      { sourceAttachmentId: new ObjectId(attachmentId) },
      { $set: { sourceFileName: fileName } },
    )
  } catch {
    /* ignore */
  }
}
