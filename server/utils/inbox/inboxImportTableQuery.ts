/**
 * Shared logic for inbox import table APIs (Eitje / Bork / Power BI).
 * Typed collections use prefix inbox-* per ensureInboxCollections; Eitje default view reads parseddatas.
 *
 * @last-modified: 2026-04-23T22:00:00.000Z
 * @last-fix: [2026-04-23] reportDate matches BSON date or legacy DD/MM/YYYY string fields (Date/Datum)
 *
 * @exports-to:
 * ✓ server/api/inbox/test-data/[type].get.ts (legacy)
 * ✓ server/api/inbox/eitje/*.get.ts
 * ✓ server/api/inbox/bork/*.get.ts
 * ✓ server/api/inbox/power-bi/reports.get.ts
 */

import { createError } from 'h3'
import { ObjectId, type Collection, type Document } from 'mongodb'
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
  /** YYYY-MM-DD: filter mapped rows where business `date` falls on that calendar day in Europe/Amsterdam */
  reportDate?: string | null
}

export type InboxImportTablePayload = {
  type: InboxImportDocumentType
  viewMode?: 'attachment' | 'mapped' | 'collection'
  collectionName: string
  mongoDatabase: string
  parsedImportCount: number
  reportDate?: string | null
  /** When rows were written into this view (parsedAt / created_at), ISO strings for UI after title */
  storedRowTimeRange?: { minParsedAt: string | null; maxParsedAt: string | null }
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

function toIso(d: unknown): string | null {
  if (d == null) return null
  const t = d instanceof Date ? d.getTime() : new Date(String(d)).getTime()
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

const YMD_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Plain YYYY-MM-DD → UTC start/end of that calendar day (for parsedAt filters). */
function utcDayBounds(ymd: string, end: boolean): Date {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  if (!y || !m || !d) throw new Error(`Invalid ymd: ${ymd}`)
  if (end) return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

function parseQueryDateBoundary(s: string, endOfDay: boolean): Date {
  const t = s.trim()
  if (YMD_ONLY.test(t)) return utcDayBounds(t, endOfDay)
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`)
  return d
}

async function attachmentViewTimeRange(
  parsedCol: Collection<Document>,
  match: Record<string, unknown>,
): Promise<{ minParsedAt: string | null; maxParsedAt: string | null }> {
  const [row] = await parsedCol
    .aggregate<{ _id: null; minC: Date | null; maxC: Date | null }>([
      { $match: match },
      { $group: { _id: null, minC: { $min: '$created_at' }, maxC: { $max: '$created_at' } } },
    ])
    .toArray()
  return { minParsedAt: toIso(row?.minC), maxParsedAt: toIso(row?.maxC) }
}

async function collectionViewTimeRange(
  collection: Collection<Document>,
  filters: Record<string, unknown>,
): Promise<{ minParsedAt: string | null; maxParsedAt: string | null }> {
  const [row] = await collection
    .aggregate<{ _id: null; minP: Date | null; maxP: Date | null }>([
      { $match: filters },
      {
        $group: {
          _id: null,
          minP: {
            $min: {
              $ifNull: ['$parsedAt', { $ifNull: ['$importedAt', '$created_at'] }],
            },
          },
          maxP: {
            $max: {
              $ifNull: ['$parsedAt', { $ifNull: ['$importedAt', '$created_at'] }],
            },
          },
        },
      },
    ])
    .toArray()
  return { minParsedAt: toIso(row?.minP), maxParsedAt: toIso(row?.maxP) }
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
    reportDate: q.reportDate ? String(q.reportDate) : null,
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
    try {
      if (input.dateFrom) {
        dateFromD = parseQueryDateBoundary(input.dateFrom, false)
        ;(filters.parsedAt as Record<string, Date>).$gte = dateFromD
      }
      if (input.dateTo) {
        dateToD = parseQueryDateBoundary(input.dateTo, true)
        ;(filters.parsedAt as Record<string, Date>).$lte = dateToD
      }
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid dateFrom or dateTo' })
    }
  }

  if (input.reportDate) {
    const rd = input.reportDate.trim()
    if (!YMD_ONLY.test(rd)) {
      throw createError({ statusCode: 400, statusMessage: 'reportDate must be YYYY-MM-DD' })
    }
    /** Prefer BSON `date`; else parse `date` / `Date` / `Datum` string (DD/MM/YYYY) for inbox-bork-sales legacy rows. */
    filters.$expr = {
      $let: {
        vars: {
          effectiveDate: {
            $switch: {
              branches: [
                {
                  case: { $eq: [{ $type: '$date' }, 'date'] },
                  then: '$date',
                },
                {
                  case: { $eq: [{ $type: '$date' }, 'string'] },
                  then: {
                    $dateFromString: {
                      dateString: '$date',
                      format: '%d/%m/%Y',
                      timezone: 'Europe/Amsterdam',
                      onError: null,
                      onNull: null,
                    },
                  },
                },
              ],
              default: {
                $dateFromString: {
                  dateString: {
                    $trim: {
                      input: {
                        $toString: {
                          $ifNull: ['$Date', { $ifNull: ['$Datum', ''] }],
                        },
                      },
                    },
                  },
                  format: '%d/%m/%Y',
                  timezone: 'Europe/Amsterdam',
                  onError: null,
                  onNull: null,
                },
              },
            },
          },
        },
        in: {
          $and: [
            { $ne: ['$$effectiveDate', null] },
            {
              $eq: [
                {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$$effectiveDate',
                    timezone: 'Europe/Amsterdam',
                  },
                },
                rd,
              ],
            },
          ],
        },
      },
    }
  }

  const db = await getDb()
  const parsedCol = db.collection(INBOX_COLLECTIONS.parsedData)
  const parsedImportCount = await parsedCol.countDocuments({ documentType })

  const useAttachmentView = EITJE_ATTACHMENT_VIEW_TYPES.has(documentType) && !useMappedEitje

  if (useAttachmentView) {
    if (input.reportDate) {
      throw createError({
        statusCode: 400,
        statusMessage: 'reportDate applies to mapped collection view only. Open this type without ?view=attachment or clear reportDate.',
      })
    }
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

    const [facetResult, storedRowTimeRange] = await Promise.all([
      parsedCol
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
        .toArray(),
      attachmentViewTimeRange(parsedCol, match),
    ])

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
      reportDate: null,
      storedRowTimeRange,
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

  const [data, total, storedRowTimeRange] = await Promise.all([
    collection
      .find(filters)
      .sort({ parsedAt: -1, importedAt: -1, created_at: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filters),
    collectionViewTimeRange(collection, filters),
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
    reportDate: input.reportDate?.trim() || null,
    storedRowTimeRange,
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
