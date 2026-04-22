import { ObjectId } from 'mongodb'
import { getDb, getMongoDatabaseName } from '../../../utils/db'
import { INBOX_COLLECTIONS } from '../../../utils/inbox/constants'

type TestDataType = 'sales' | 'product_mix' | 'food_beverage' | 'basis_report' | 'product_sales_per_hour'
type AllDataType = TestDataType | 'hours' | 'contracts' | 'finance' | 'bi'

function getCollectionName(type: AllDataType): string {
  switch (type) {
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
    case 'hours':
      return 'inbox-eitje-hours'
    case 'contracts':
      return 'inbox-eitje-contracts'
    case 'finance':
      return 'inbox-eitje-finance'
    case 'bi':
      return 'power_bi_exports'
    default:
      return 'unknown'
  }
}

export default defineEventHandler(async (event) => {
  try {
    const type = getRouterParam(event, 'type') as AllDataType

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

    if (!validTypes.includes(type)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid data type. Valid types: ${validTypes.join(', ')}`,
      })
    }

    const q = getQuery(event)
    const page = Math.max(1, parseInt(String(q.page || '1'), 10))
    const limit = Math.min(200, Math.max(1, parseInt(String(q.limit || '50'), 10)))
    const skip = (page - 1) * limit

    const filters: Record<string, unknown> = {}

    const sourceEmailId = q.sourceEmailId ? String(q.sourceEmailId) : null
    if (sourceEmailId) {
      try {
        filters.sourceEmailId = new ObjectId(sourceEmailId)
      } catch {
        throw createError({ statusCode: 400, statusMessage: 'Invalid sourceEmailId format' })
      }
    }

    const dateFrom = q.dateFrom ? String(q.dateFrom) : null
    const dateTo = q.dateTo ? String(q.dateTo) : null
    if (dateFrom || dateTo) {
      filters.parsedAt = {}
      if (dateFrom) {
        (filters.parsedAt as Record<string, Date>).$gte = new Date(dateFrom)
      }
      if (dateTo) {
        (filters.parsedAt as Record<string, Date>).$lte = new Date(dateTo)
      }
    }

    const db = await getDb()
    const collectionName = getCollectionName(type)
    const collection = db.collection(collectionName)

    const [data, total, parsedImportCount] = await Promise.all([
      collection
        .find(filters)
        .sort({ parsedAt: -1, importedAt: -1, created_at: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filters),
      db.collection(INBOX_COLLECTIONS.parsedData).countDocuments({ documentType: type }),
    ])

    const allColumns = new Set<string>()
    data.forEach((doc) => {
      Object.keys(doc).forEach((key) => {
        if (
          !['_id', 'sourceEmailId', 'sourceAttachmentId', 'sourceFileName', 'fileFormat', 'parsedAt', 'created_at', 'updated_at', '__v'].includes(
            key,
          )
        ) {
          allColumns.add(key)
        }
      })
    })

    return {
      success: true,
      data: {
        type,
        collectionName,
        mongoDatabase: getMongoDatabaseName(),
        parsedImportCount,
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
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to fetch test data',
    })
  }
})
