/**
 * @registry-id: testDataAPI
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-27T00:00:00.000Z
 * @description: Test data API - retrieve raw test data by type with pagination
 * @last-fix: [2026-01-27] Added support for Eitje and Power-BI types (hours, contracts, finance, bi) by querying collections directly
 * 
 * @imports-from:
 *   - app/models/TestSales.ts => TestSales model
 *   - app/models/TestProductMix.ts => TestProductMix model
 *   - app/models/TestFoodBeverage.ts => TestFoodBeverage model
 *   - app/models/TestBasisReport.ts => TestBasisReport model
 *   - app/models/TestProductSalesPerHour.ts => TestProductSalesPerHour model
 *   - app/lib/mongodb.ts => dbConnect
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useTestDataViewModel.ts => Fetches test data
 *   ✓ app/components/test-data/** => Displays test data
 */

import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import { getDatabase } from '@/lib/mongodb/v2-connection'
import TestSales from '@/models/TestSales'
import TestProductMix from '@/models/TestProductMix'
import TestFoodBeverage from '@/models/TestFoodBeverage'
import TestBasisReport from '@/models/TestBasisReport'
import TestProductSalesPerHour from '@/models/TestProductSalesPerHour'
import type { DocumentType } from '@/lib/types/inbox.types'
import { ObjectId } from 'mongodb'

type TestDataType = 'sales' | 'product_mix' | 'food_beverage' | 'basis_report' | 'product_sales_per_hour'
type AllDataType = TestDataType | 'hours' | 'contracts' | 'finance' | 'bi'

/**
 * Get model for test data type
 */
function getModelForType(type: TestDataType) {
  switch (type) {
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
 * Get collection name for data type (test- prefix or regular collection)
 */
function getCollectionName(type: AllDataType): string {
  switch (type) {
    case 'sales':
      return 'test-sales'
    case 'product_mix':
      return 'test-product-mix'
    case 'food_beverage':
      return 'test-food-beverage'
    case 'basis_report':
      return 'test-basis-report'
    case 'product_sales_per_hour':
      return 'test-product-sales-per-hour'
    case 'hours':
      return 'eitje_hours'
    case 'contracts':
      return 'eitje_contracts'
    case 'finance':
      return 'eitje_finance'
    case 'bi':
      return 'power_bi_exports'
    default:
      return 'unknown'
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    await dbConnect()

    const { type } = await params
    const dataType = type as AllDataType

    // Validate type
    const validTypes: AllDataType[] = [
      'sales',
      'product_mix',
      'food_beverage',
      'basis_report',
      'product_sales_per_hour',
      'hours',
      'contracts',
      'finance',
      'bi',
    ]

    if (!validTypes.includes(dataType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid data type: ${type}. Valid types: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Check if it's a test data type (has Mongoose model) or regular collection
    const isTestDataType = ['sales', 'product_mix', 'food_beverage', 'basis_report', 'product_sales_per_hour'].includes(dataType)
    const Model = isTestDataType ? getModelForType(dataType as TestDataType) : null

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const skip = (page - 1) * limit

    // Build filters
    const filters: Record<string, unknown> = {}

    const sourceEmailId = searchParams.get('sourceEmailId')
    if (sourceEmailId) {
      try {
        filters.sourceEmailId = new ObjectId(sourceEmailId)
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid sourceEmailId format',
          },
          { status: 400 }
        )
      }
    }

    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    if (dateFrom || dateTo) {
      filters.parsedAt = {}
      if (dateFrom) {
        filters.parsedAt = { ...filters.parsedAt, $gte: new Date(dateFrom) }
      }
      if (dateTo) {
        filters.parsedAt = { ...filters.parsedAt, $lte: new Date(dateTo) }
      }
    }

    // Query data - use Mongoose model for test types, direct collection for others
    let data: unknown[] = []
    let total = 0

    if (Model) {
      // Use Mongoose model for test data types
      const [modelData, modelTotal] = await Promise.all([
        Model.find(filters)
          .sort({ parsedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Model.countDocuments(filters),
      ])
      data = modelData
      total = modelTotal
    } else {
      // Query collection directly for Eitje/Power-BI types
      const db = await getDatabase()
      const collectionName = getCollectionName(dataType)
      const collection = db.collection(collectionName)

      // Convert filters for MongoDB native queries
      const mongoFilters: Record<string, unknown> = {}
      if (filters.sourceEmailId) {
        mongoFilters.sourceEmailId = filters.sourceEmailId
      }
      if (filters.parsedAt) {
        mongoFilters.parsedAt = filters.parsedAt
      }

      const [collectionData, collectionTotal] = await Promise.all([
        collection
          .find(mongoFilters)
          .sort({ parsedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        collection.countDocuments(mongoFilters),
      ])
      data = collectionData
      total = collectionTotal
    }

    // Extract all unique column names from data
    const allColumns = new Set<string>()
    data.forEach((doc) => {
      Object.keys(doc).forEach((key) => {
        // Exclude metadata fields
        if (
          !['_id', 'sourceEmailId', 'sourceAttachmentId', 'sourceFileName', 'fileFormat', 'parsedAt', 'created_at', 'updated_at', '__v'].includes(
            key
          )
        ) {
          allColumns.add(key)
        }
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        type: dataType,
        collectionName: getCollectionName(dataType),
        rows: data,
        columns: Array.from(allColumns).sort(),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + limit < total,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch test data',
      },
      { status: 500 }
    )
  }
}
