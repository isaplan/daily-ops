/**
 * @registry-id: inboxRepository
 * @created: 2026-04-18T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: Inbox Mongo CRUD (native driver, same collections as next-js-old Mongoose)
 * @last-fix: [2026-04-18] Initial Nuxt implementation
 *
 * @exports-to:
 * ✓ server/services/inboxProcessService.ts
 * ✓ server/api/inbox (all routes)
 */

import { ObjectId, type Filter, type Document } from 'mongodb'
import { getDb } from '../utils/db'
import { INBOX_COLLECTIONS } from '../utils/inbox/constants'
import type {
  CreateEmailAttachmentDto,
  CreateInboxEmailDto,
  CreateParsedDataDto,
  CreateProcessingLogDto,
  EmailAttachmentDoc,
  InboxEmailDoc,
  InboxEmailFilters,
  InboxListResponse,
  ParsedDataDoc,
  UpdateInboxEmailDto,
  UpdateEmailAttachmentDto,
} from '~/types/inbox'

type ParseStatus = EmailAttachmentDoc['parseStatus']
type DocType = EmailAttachmentDoc['documentType']

function oid(id: string): ObjectId {
  return new ObjectId(id)
}

function serializeEmail(doc: Document): InboxEmailDoc {
  const o = doc as Record<string, unknown>
  return {
    _id: String(o._id),
    messageId: String(o.messageId),
    from: String(o.from),
    subject: String(o.subject),
    receivedAt: (o.receivedAt instanceof Date ? o.receivedAt : new Date(String(o.receivedAt))).toISOString(),
    storedAt: (o.storedAt instanceof Date ? o.storedAt : new Date(String(o.storedAt ?? o.receivedAt))).toISOString(),
    status: o.status as InboxEmailDoc['status'],
    hasAttachments: Boolean(o.hasAttachments),
    attachmentCount: Number(o.attachmentCount ?? 0),
    summary: o.summary != null ? String(o.summary) : undefined,
    errorMessage: o.errorMessage != null ? String(o.errorMessage) : undefined,
    processedAt: o.processedAt instanceof Date ? o.processedAt.toISOString() : o.processedAt != null ? String(o.processedAt) : undefined,
    lastAttempt: o.lastAttempt instanceof Date ? o.lastAttempt.toISOString() : o.lastAttempt != null ? String(o.lastAttempt) : undefined,
    retryCount: Number(o.retryCount ?? 0),
    archived: Boolean(o.archived),
    archivedAt: o.archivedAt instanceof Date ? o.archivedAt.toISOString() : o.archivedAt != null ? String(o.archivedAt) : undefined,
    metadata: (o.metadata as InboxEmailDoc['metadata']) ?? {},
  }
}

function serializeAttachment(doc: Document): EmailAttachmentDoc {
  const o = doc as Record<string, unknown>
  return {
    _id: String(o._id),
    emailId: String(o.emailId),
    fileName: String(o.fileName),
    mimeType: String(o.mimeType),
    fileSize: Number(o.fileSize),
    googleAttachmentId: String(o.googleAttachmentId),
    downloadedAt: (o.downloadedAt instanceof Date ? o.downloadedAt : new Date()).toISOString(),
    storedLocally: Boolean(o.storedLocally),
    documentType: o.documentType as EmailAttachmentDoc['documentType'],
    parseStatus: o.parseStatus as EmailAttachmentDoc['parseStatus'],
    parseError: o.parseError != null ? String(o.parseError) : undefined,
    parsedDataRef: o.parsedDataRef != null ? String(o.parsedDataRef) : undefined,
    metadata: (o.metadata as EmailAttachmentDoc['metadata']) ?? { format: 'unknown' },
    originalData: o.originalData != null ? String(o.originalData) : undefined,
  }
}

function serializeParsed(doc: Document): ParsedDataDoc {
  const o = doc as Record<string, unknown>
  return {
    _id: String(o._id),
    attachmentId: String(o.attachmentId),
    emailId: String(o.emailId),
    documentType: o.documentType as ParsedDataDoc['documentType'],
    extractedAt: (o.extractedAt instanceof Date ? o.extractedAt : new Date()).toISOString(),
    format: o.format as ParsedDataDoc['format'],
    rowsProcessed: Number(o.rowsProcessed ?? 0),
    rowsValid: Number(o.rowsValid ?? 0),
    rowsFailed: Number(o.rowsFailed ?? 0),
    data: o.data as ParsedDataDoc['data'],
    mapping: (o.mapping as ParsedDataDoc['mapping']) ?? {},
    validationErrors: o.validationErrors as ParsedDataDoc['validationErrors'],
  }
}

export async function listEmails(
  page: number,
  limit: number,
  filters: InboxEmailFilters,
): Promise<InboxListResponse> {
  const db = await getDb()
  const col = db.collection(INBOX_COLLECTIONS.inboxEmail)
  const skip = (page - 1) * limit

  const mongoFilter: Filter<Document> = {}

  if (filters.status) mongoFilter.status = filters.status
  if (filters.from) mongoFilter.from = filters.from
  if (filters.archived !== undefined) {
    mongoFilter.archived = filters.archived
  } else {
    mongoFilter.archived = false
  }

  if (filters.dateFrom || filters.dateTo) {
    mongoFilter.receivedAt = {}
    if (filters.dateFrom) {
      (mongoFilter.receivedAt as Record<string, Date>).$gte = filters.dateFrom
    }
    if (filters.dateTo) {
      (mongoFilter.receivedAt as Record<string, Date>).$lte = filters.dateTo
    }
  }

  const [emails, total] = await Promise.all([
    col.find(mongoFilter).sort({ receivedAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(mongoFilter),
  ])

  const emailIds = emails.map((e) => e._id as ObjectId)

  const attachmentCounts =
    emailIds.length > 0
      ? await db
          .collection(INBOX_COLLECTIONS.emailAttachment)
          .aggregate([
            { $match: { emailId: { $in: emailIds } } },
            {
              $group: {
                _id: '$emailId',
                count: { $sum: 1 },
                parsedCount: {
                  $sum: { $cond: [{ $eq: ['$parseStatus', 'success'] }, 1, 0] },
                },
              },
            },
          ])
          .toArray()
      : []

  const countMap = new Map(
    attachmentCounts.map((ac) => [
      (ac._id as ObjectId).toString(),
      { total: ac.count as number, parsed: ac.parsedCount as number },
    ]),
  )

  const emailsOut: InboxEmailDoc[] = emails.map((email) => {
    const base = serializeEmail(email)
    const stats = countMap.get(String(email._id))
    return {
      ...base,
      attachmentStats: stats || { total: 0, parsed: 0 },
    }
  })

  return {
    emails: emailsOut,
    total,
    hasMore: skip + limit < total,
    page,
    limit,
  }
}

export async function getEmailWithAttachments(id: string): Promise<{
  email: InboxEmailDoc
  attachments: Array<EmailAttachmentDoc & { parsedData?: ParsedDataDoc }>
} | null> {
  const db = await getDb()
  const emailCol = db.collection(INBOX_COLLECTIONS.inboxEmail)
  const attCol = db.collection(INBOX_COLLECTIONS.emailAttachment)
  const parsedCol = db.collection(INBOX_COLLECTIONS.parsedData)

  let _id: ObjectId
  try {
    _id = oid(id)
  } catch {
    return null
  }

  const email = await emailCol.findOne({ _id })
  if (!email) return null

  const attachments = await attCol.find({ emailId: _id }).toArray()
  const parsedIds = attachments
    .map((a) => a.parsedDataRef)
    .filter((x): x is ObjectId => x instanceof ObjectId)

  const parsedMap = new Map<string, ParsedDataDoc>()
  if (parsedIds.length > 0) {
    const parsedDocs = await parsedCol.find({ _id: { $in: parsedIds } }).toArray()
    parsedDocs.forEach((pd) => {
      parsedMap.set(String(pd._id), serializeParsed(pd))
    })
  }

  const attachmentsOut = attachments.map((att) => {
    const base = serializeAttachment(att)
    const pdRef = att.parsedDataRef
    return {
      ...base,
      parsedData: pdRef ? parsedMap.get(String(pdRef)) : undefined,
    }
  })

  return {
    email: serializeEmail(email),
    attachments: attachmentsOut,
  }
}

export async function findEmailByMessageId(messageId: string): Promise<Document | null> {
  const db = await getDb()
  return db.collection(INBOX_COLLECTIONS.inboxEmail).findOne({ messageId })
}

export async function insertEmail(
  dto: CreateInboxEmailDto,
  opts?: { status?: InboxEmailDoc['status'] },
): Promise<{ _id: ObjectId }> {
  const db = await getDb()
  const now = new Date()
  const doc = {
    messageId: dto.messageId,
    from: dto.from,
    subject: dto.subject,
    receivedAt: dto.receivedAt,
    storedAt: now,
    status: (opts?.status ?? 'received') as InboxEmailDoc['status'],
    hasAttachments: dto.hasAttachments,
    attachmentCount: dto.attachmentCount,
    summary: dto.summary,
    retryCount: 0,
    archived: false,
    metadata: dto.metadata ?? {},
    created_at: now,
    updated_at: now,
  }
  const r = await db.collection(INBOX_COLLECTIONS.inboxEmail).insertOne(doc)
  return { _id: r.insertedId }
}

export async function insertAttachment(
  emailId: ObjectId,
  dto: CreateEmailAttachmentDto,
  extra?: {
    parseStatus?: string
    documentType?: string
    originalData?: string
    parseError?: string
  },
): Promise<{ _id: ObjectId }> {
  const db = await getDb()
  const now = new Date()
  const doc = {
    emailId,
    fileName: dto.fileName,
    mimeType: dto.mimeType,
    fileSize: dto.fileSize,
    googleAttachmentId: dto.googleAttachmentId,
    downloadedAt: now,
    storedLocally: false,
    documentType: (extra?.documentType ?? dto.documentType ?? 'other') as DocType,
    parseStatus: (extra?.parseStatus ?? 'pending') as ParseStatus,
    parseError: extra?.parseError,
    metadata: {
      format: dto.metadata?.format ?? 'unknown',
      sheets: dto.metadata?.sheets,
      delimiter: dto.metadata?.delimiter,
    },
    originalData: extra?.originalData ?? dto.originalData,
    created_at: now,
    updated_at: now,
  }
  const r = await db.collection(INBOX_COLLECTIONS.emailAttachment).insertOne(doc)
  return { _id: r.insertedId }
}

export async function insertParsedData(dto: CreateParsedDataDto): Promise<{ _id: ObjectId }> {
  const db = await getDb()
  const now = new Date()
  const doc = {
    attachmentId: oid(dto.attachmentId),
    emailId: oid(dto.emailId),
    documentType: dto.documentType,
    extractedAt: now,
    format: dto.format,
    rowsProcessed: dto.rowsProcessed,
    rowsValid: dto.rowsValid,
    rowsFailed: dto.rowsFailed,
    data: dto.data,
    mapping: dto.mapping ?? {},
    validationErrors: dto.validationErrors,
    created_at: now,
    updated_at: now,
  }
  const r = await db.collection(INBOX_COLLECTIONS.parsedData).insertOne(doc)
  return { _id: r.insertedId }
}

export async function updateAttachment(
  id: string,
  patch: UpdateEmailAttachmentDto & { parsedDataRef?: ObjectId },
): Promise<void> {
  const db = await getDb()
  const $set: Record<string, unknown> = { ...patch, updated_at: new Date() }
  if (patch.parsedDataRef !== undefined) {
    $set.parsedDataRef = patch.parsedDataRef
  }
  await db.collection(INBOX_COLLECTIONS.emailAttachment).updateOne({ _id: oid(id) }, { $set })
}

export async function updateEmail(id: string, patch: UpdateInboxEmailDto & { status?: string }): Promise<void> {
  const db = await getDb()
  await db
    .collection(INBOX_COLLECTIONS.inboxEmail)
    .updateOne({ _id: oid(id) }, { $set: { ...patch, updated_at: new Date() } })
}

export async function updateParsedData(id: string, patch: Record<string, unknown>): Promise<void> {
  const db = await getDb()
  await db
    .collection(INBOX_COLLECTIONS.parsedData)
    .updateOne({ _id: oid(id) }, { $set: { ...patch, updated_at: new Date() } })
}

export async function insertProcessingLog(dto: CreateProcessingLogDto): Promise<void> {
  const db = await getDb()
  const now = new Date()
  await db.collection(INBOX_COLLECTIONS.processingLog).insertOne({
    emailId: dto.emailId ? oid(dto.emailId) : undefined,
    attachmentId: dto.attachmentId ? oid(dto.attachmentId) : undefined,
    eventType: dto.eventType,
    status: dto.status,
    message: dto.message,
    timestamp: now,
    duration: dto.duration,
    details: dto.details,
    created_at: now,
  })
}

export async function countUnprocessedAttachments(): Promise<number> {
  const db = await getDb()
  return db.collection(INBOX_COLLECTIONS.emailAttachment).countDocuments({
    parseStatus: { $ne: 'success' },
  })
}

export async function findAttachmentsByEmail(emailId: ObjectId, filter: Filter<Document>) {
  const db = await getDb()
  return db.collection(INBOX_COLLECTIONS.emailAttachment).find({ emailId, ...filter }).toArray()
}

export async function getAttachmentById(id: string): Promise<Document | null> {
  const db = await getDb()
  try {
    return db.collection(INBOX_COLLECTIONS.emailAttachment).findOne({ _id: oid(id) })
  } catch {
    return null
  }
}

export async function getEmailDocById(id: string): Promise<Document | null> {
  const db = await getDb()
  try {
    return db.collection(INBOX_COLLECTIONS.inboxEmail).findOne({ _id: oid(id) })
  } catch {
    return null
  }
}
