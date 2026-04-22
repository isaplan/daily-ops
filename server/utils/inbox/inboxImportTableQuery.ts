/**
 * Shared logic for inbox import table APIs (Eitje / Bork / Power BI).
 * Typed collections use prefix inbox-* per ensureInboxCollections; Eitje default view reads parseddatas.
 *
 * @exports-to:
 * ✓ server/api/inbox/test-data/[type].get.ts (legacy)
 * ✓ server/api/inbox/eitje/*.get.ts
 * ✓ server/api/inbox/bork/*.get.ts
 * ✓ server/api/inbox/power-bi/reports.get.ts
 */

import { createError } from 'h3'
import { ObjectId, type Document } from 'mongodb'
import { getDb, getMongoDatabaseName } from '../db'
import { INBOX_COLLECTIONS } from './constants'

export type InboxImportDocumentType =
  | 'sales'
  | 'product_mix'
  | 'food_beverage'
  | 'basis_report'
  | 'product_sales_per_hour'
  | 'hours'
  | 'contracts'
  | 'finance'
  | 'bi'

export type InboxImportTableQuery = {
  page: number
  limit: number
  /** Eitje only: mapped = inbox-eitje-* collection; omit or attachment = exact rows from parseddatas */
  view?: 'mapped' | 'attachment'
  sourceEmailId?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

export type InboxImportTablePayload = {
  type: InboxImportDocumentType
  viewMode?: 'attachment' | 'mapped' | 'collection'
  collectionName: string
  mongoDatabase: string
  parsedImportCount: number
  rows: Record<string, unknown>[]
  columns: string[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

const EITJE_ATTACHMENT_VIEW_TYPES = new Set<InboxImportDocumentType>(['hours', 'contracts', 'finance'])

function sortDisplayColumns(cols: string[]): string[] {
  const meta = cols.filter((c) => c.startsWith('_')).sort((a, b) => a.localeCompare(b))
  const rest = cols.filter((c) => !c.startsWith('_')).sort((a, b) => a.localeCompare(b))
  return [...rest, ...meta]
}

function storageCollectionName(type: InboxImportDocumentType): string {
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

/** Parse Nitro getQuery into pagination + filters */
export function parseInboxImportTableQuery(q: Record<string, unknown>): InboxImportTableQuery {
  const page = Math.max(1, parseInt(String(q.page || '1'), 10))
  const limit = Math.min(200, Math.max(1, parseInt(String(q.limit || '50'), 10)))
  const viewRaw = q.view ? String(q.view).toLowerCase() : ''
  const view = viewRaw === 'mapped' ? ('mapped' as const) : viewRaw === 'attachment' ? ('attachment' as const) : undefined
  return {
    page,
    limit,
    view,
    sourceEmailId: q.sourceEmailId ? String(q.sourceEmailId) : null,
    dateFrom: q.dateFrom ? String(q.dateFrom) : null,
    dateTo: q.dateTo ? String(q.dateTo) : null,
  }
}

export async function getInboxImportTablePayload(
  documentType: InboxImportDocumentType,
  input: InboxImportTableQuery,
): Promise<InboxImportTablePayload> {
  const page = input.page
  const limit = input.limit
  const skip = (page - 1) * limit
  const useMappedEitje = input.view === 'mapped'

  const filters: Record<string, unknown> = {}
  let sourceEmailOid: ObjectId | null = null
  if (input.sourceEmailId) {
    try {
      sourceEmailOid = new ObjectId(input.sourceEmailId)
      filters.sourceEmailId = sourceEmailOid
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid sourceEmailId format' })
    }
  }

  let dateFromD: Date | null = null
  let dateToD: Date | null = null
  if (input.dateFrom || input.dateTo) {
    filters.parsedAt = {}
    if (input.dateFrom) {
      dateFromD = new Date(input.dateFrom)
      ;(filters.parsedAt as Record<string, Date>).$gte = dateFromD
    }
    if (input.dateTo) {
      dateToD = new Date(input.dateTo)
      ;(filters.parsedAt as Record<string, Date>).$lte = dateToD
    }
  }

  const db = await getDb()
  const parsedCol = db.collection(INBOX_COLLECTIONS.parsedData)
  const parsedImportCount = await parsedCol.countDocuments({ documentType })

  const useAttachmentView = EITJE_ATTACHMENT_VIEW_TYPES.has(documentType) && !useMappedEitje

  if (useAttachmentView) {
    const match: Record<string, unknown> = {
      documentType,
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
      type: documentType,
      viewMode: 'attachment',
      collectionName: `parseddatas (documentType=${documentType}, exact rows)`,
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
    }
  }

  const collectionName = storageCollectionName(documentType)
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
    useMappedEitje && EITJE_ATTACHMENT_VIEW_TYPES.has(documentType) ? 'mapped' : 'collection'

  return {
    type: documentType,
    viewMode,
    collectionName,
    mongoDatabase: getMongoDatabaseName(),
    parsedImportCount,
    rows: data as Record<string, unknown>[],
    columns: Array.from(allColumns).sort(),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    },
  }
}
