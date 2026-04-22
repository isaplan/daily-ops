import { ObjectId, type Document } from 'mongodb'
import { getDb, getMongoDatabaseName } from '../../../utils/db'
import { INBOX_COLLECTIONS } from '../../../utils/inbox/constants'

type TestDataType = 'sales' | 'product_mix' | 'food_beverage' | 'basis_report' | 'product_sales_per_hour'
type AllDataType = TestDataType | 'hours' | 'contracts' | 'finance' | 'bi'

/** Eitje types: show exact CSV/Excel columns from parsed attachments (parseddatas), not mapped inbox-eitje-* rows. */
const EITJE_ATTACHMENT_VIEW_TYPES = new Set<AllDataType>(['hours', 'contracts', 'finance'])

function sortDisplayColumns(cols: string[]): string[] {
  const meta = cols.filter((c) => c.startsWith('_')).sort((a, b) => a.localeCompare(b))
  const rest = cols.filter((c) => !c.startsWith('_')).sort((a, b) => a.localeCompare(b))
  return [...rest, ...meta]
}

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
    const viewParam = q.view ? String(q.view).toLowerCase() : ''
    const useMappedEitje = viewParam === 'mapped'

    const filters: Record<string, unknown> = {}

    const sourceEmailId = q.sourceEmailId ? String(q.sourceEmailId) : null
    let sourceEmailOid: ObjectId | null = null
    if (sourceEmailId) {
      try {
        sourceEmailOid = new ObjectId(sourceEmailId)
        filters.sourceEmailId = sourceEmailOid
      } catch {
        throw createError({ statusCode: 400, statusMessage: 'Invalid sourceEmailId format' })
      }
    }

    const dateFrom = q.dateFrom ? String(q.dateFrom) : null
    const dateTo = q.dateTo ? String(q.dateTo) : null
    let dateFromD: Date | null = null
    let dateToD: Date | null = null
    if (dateFrom || dateTo) {
      filters.parsedAt = {}
      if (dateFrom) {
        dateFromD = new Date(dateFrom)
        ;(filters.parsedAt as Record<string, Date>).$gte = dateFromD
      }
      if (dateTo) {
        dateToD = new Date(dateTo)
        ;(filters.parsedAt as Record<string, Date>).$lte = dateToD
      }
    }

    const db = await getDb()
    const parsedCol = db.collection(INBOX_COLLECTIONS.parsedData)
    const parsedImportCount = await parsedCol.countDocuments({ documentType: type })

    const useAttachmentView = EITJE_ATTACHMENT_VIEW_TYPES.has(type) && !useMappedEitje

    if (useAttachmentView) {
      const match: Record<string, unknown> = {
        documentType: type,
        'data.rows.0': { $exists: true },
      }
      if (sourceEmailOid) match.emailId = sourceEmailOid
      if (dateFromD || dateToD) {
        match.created_at = {}
        if (dateFromD) (match.created_at as Record<string, Date>).$gte = dateFromD
        if (dateToD) (match.created_at as Record<string, Date>).$lte = dateToD
      }

      const facetResult = await parsedCol
        .aggregate<{ rows: Document[]; count: { n: number }[] }>([
          { $match: match },
          { $sort: { created_at: -1 } },
          { $unwind: { path: '$data.rows' } },
          { $match: { 'data.rows': { $type: 'object' } } },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: [
                  '$data.rows',
                  {
                    _parsedDataId: '$_id',
                    _inboxEmailId: '$emailId',
                    _inboxAttachmentId: '$attachmentId',
                    _parsedAt: '$created_at',
                  },
                ],
              },
            },
          },
          {
            $facet: {
              rows: [{ $sort: { _parsedAt: -1 } }, { $skip: skip }, { $limit: limit }],
              count: [{ $count: 'n' }],
            },
          },
        ])
        .toArray()

      const facet = facetResult[0]
      const data = (facet?.rows ?? []) as Record<string, unknown>[]
      const total = facet?.count?.[0]?.n ?? 0

      const allColumns = new Set<string>()
      data.forEach((doc) => {
        Object.keys(doc).forEach((key) => {
          if (key !== '_id') allColumns.add(key)
        })
      })

      return {
        success: true,
        data: {
          type,
          viewMode: 'attachment' as const,
          collectionName: `parseddatas (documentType=${type}, exact rows)`,
          mongoDatabase: getMongoDatabaseName(),
          parsedImportCount,
          rows: data,
          columns: sortDisplayColumns(Array.from(allColumns)),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + limit < total,
          },
        },
      }
    }

    const collectionName = getCollectionName(type)
    const collection = db.collection(collectionName)

    const [data, total] = await Promise.all([
      collection
        .find(filters)
        .sort({ parsedAt: -1, importedAt: -1, created_at: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filters),
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

    const viewMode: 'mapped' | 'collection' =
      useMappedEitje && EITJE_ATTACHMENT_VIEW_TYPES.has(type) ? 'mapped' : 'collection'

    return {
      success: true,
      data: {
        type,
        viewMode,
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
