/**
 * @registry-id: rawDataStorageService
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-29T00:00:00.000Z
 * @description: Raw data storage service - stores parsed data without transformations (exact copy from files)
 * @last-fix: [2026-01-29] Use mongoose.Types.ObjectId instead of mongodb ObjectId to avoid BSON 6.x vs 7.x mismatch
 * 
 * @imports-from:
 *   - app/models/TestSales.ts => TestSales model
 *   - app/models/TestProductMix.ts => TestProductMix model
 *   - app/models/TestFoodBeverage.ts => TestFoodBeverage model
 *   - app/models/TestBasisReport.ts => TestBasisReport model
 *   - app/models/TestProductSalesPerHour.ts => TestProductSalesPerHour model
 *   - app/lib/types/inbox.types.ts => DocumentType, CreateParsedDataDto
 * 
 * @exports-to:
 *   ✓ app/api/inbox/process/[emailId]/route.ts => Stores raw data for test document types
 */

import mongoose from 'mongoose'
import TestSales from '@/models/TestSales'
import TestProductMix from '@/models/TestProductMix'
import TestFoodBeverage from '@/models/TestFoodBeverage'
import TestBasisReport from '@/models/TestBasisReport'
import TestProductSalesPerHour from '@/models/TestProductSalesPerHour'
import type { DocumentType, CreateParsedDataDto } from '@/lib/types/inbox.types'

export interface RawStorageResult {
  success: boolean
  collectionName: string
  recordsCreated: number
  recordsFailed: number
  errors: Array<{ row: number; error: string }>
}

export interface StoreRawDataOptions {
  fileName?: string
}

/**
 * Map document type to model
 */
function getModelForType(documentType: DocumentType) {
  switch (documentType) {
    case 'sales':
      return TestSales
    case 'product_mix':
      return TestProductMix
    case 'food_beverage':
      return TestFoodBeverage
    case 'basis_report':
      return TestBasisReport
    case 'product_sales_per_hour':
      return TestProductSalesPerHour
    default:
      return null
  }
}

/**
 * Get collection name for document type
 */
function getCollectionName(documentType: DocumentType): string {
  switch (documentType) {
    case 'sales':
      return 'test-bork-sales'
    case 'product_mix':
      return 'test-bork-product-mix'
    case 'food_beverage':
      return 'test-bork-food-beverage'
    case 'basis_report':
      return 'test-basis-report'
    case 'product_sales_per_hour':
      return 'test-bork-basis-rapport'
    default:
      return 'unknown'
  }
}

/**
 * Check if document type is a test data type
 */
export function isTestDataType(documentType: DocumentType): boolean {
  return [
    'sales',
    'product_mix',
    'food_beverage',
    'basis_report',
    'product_sales_per_hour',
  ].includes(documentType)
}

/**
 * Store raw parsed data without transformations
 */
export async function storeRawData(
  parsedData: CreateParsedDataDto,
  documentType: DocumentType,
  options?: StoreRawDataOptions
): Promise<RawStorageResult> {
  // Check if this is a test data type
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

  const Model = getModelForType(documentType)
  if (!Model) {
    return {
      success: false,
      collectionName: getCollectionName(documentType),
      recordsCreated: 0,
      recordsFailed: parsedData.rowsProcessed,
      errors: [
        {
          row: 0,
          error: `No model found for document type: ${documentType}`,
        },
      ],
    }
  }

  const collectionName = getCollectionName(documentType)
  const errors: Array<{ row: number; error: string }> = []
  let recordsCreated = 0

  try {
    // Use Mongoose ObjectId so BSON version matches (mongoose uses bson 6.x; top-level mongodb uses 7.x)
    const emailId = new mongoose.Types.ObjectId(parsedData.emailId)
    const attachmentId = new mongoose.Types.ObjectId(parsedData.attachmentId)

    // Store each row as a separate document with raw data
    const documentsToInsert = parsedData.data.rows.map((row, index) => {
      try {
        // Create document with raw row data + metadata
        const doc: Record<string, unknown> = {
          ...row, // Spread all raw row data as-is
          sourceEmailId: emailId,
          sourceAttachmentId: attachmentId,
          sourceFileName: options?.fileName || '', // Set from options if provided
          fileFormat: parsedData.format,
          parsedAt: new Date(),
        }

        return doc
      } catch (error) {
        errors.push({
          row: index + 1,
          error: error instanceof Error ? error.message : 'Unknown error creating document',
        })
        return null
      }
    }).filter((doc): doc is Record<string, unknown> => doc !== null)

    // Insert all documents
    if (documentsToInsert.length > 0) {
      const result = await Model.insertMany(documentsToInsert, { ordered: false })
      recordsCreated = result.length
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

/**
 * Update source file name for stored records
 */
export async function updateSourceFileName(
  documentType: DocumentType,
  attachmentId: string,
  fileName: string
): Promise<void> {
  if (!isTestDataType(documentType)) {
    return
  }

  const Model = getModelForType(documentType)
  if (!Model) {
    return
  }

  try {
    await Model.updateMany(
      { sourceAttachmentId: new mongoose.Types.ObjectId(attachmentId) },
      { $set: { sourceFileName: fileName } }
    )
  } catch (error) {
    console.error(`[rawDataStorageService] Error updating source file name:`, error)
  }
}
