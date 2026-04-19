import { ObjectId } from 'mongodb';
import { g as getDb, I as INBOX_COLLECTIONS } from '../nitro/nitro.mjs';

function oid(id) {
  return new ObjectId(id);
}
function serializeEmail(doc) {
  var _a, _b, _c, _d;
  const o = doc;
  return {
    _id: String(o._id),
    messageId: String(o.messageId),
    from: String(o.from),
    subject: String(o.subject),
    receivedAt: (o.receivedAt instanceof Date ? o.receivedAt : new Date(String(o.receivedAt))).toISOString(),
    storedAt: (o.storedAt instanceof Date ? o.storedAt : new Date(String((_a = o.storedAt) != null ? _a : o.receivedAt))).toISOString(),
    status: o.status,
    hasAttachments: Boolean(o.hasAttachments),
    attachmentCount: Number((_b = o.attachmentCount) != null ? _b : 0),
    summary: o.summary != null ? String(o.summary) : void 0,
    errorMessage: o.errorMessage != null ? String(o.errorMessage) : void 0,
    processedAt: o.processedAt instanceof Date ? o.processedAt.toISOString() : o.processedAt != null ? String(o.processedAt) : void 0,
    lastAttempt: o.lastAttempt instanceof Date ? o.lastAttempt.toISOString() : o.lastAttempt != null ? String(o.lastAttempt) : void 0,
    retryCount: Number((_c = o.retryCount) != null ? _c : 0),
    archived: Boolean(o.archived),
    archivedAt: o.archivedAt instanceof Date ? o.archivedAt.toISOString() : o.archivedAt != null ? String(o.archivedAt) : void 0,
    metadata: (_d = o.metadata) != null ? _d : {}
  };
}
function serializeAttachment(doc) {
  var _a;
  const o = doc;
  return {
    _id: String(o._id),
    emailId: String(o.emailId),
    fileName: String(o.fileName),
    mimeType: String(o.mimeType),
    fileSize: Number(o.fileSize),
    googleAttachmentId: String(o.googleAttachmentId),
    downloadedAt: (o.downloadedAt instanceof Date ? o.downloadedAt : /* @__PURE__ */ new Date()).toISOString(),
    storedLocally: Boolean(o.storedLocally),
    documentType: o.documentType,
    parseStatus: o.parseStatus,
    parseError: o.parseError != null ? String(o.parseError) : void 0,
    parsedDataRef: o.parsedDataRef != null ? String(o.parsedDataRef) : void 0,
    metadata: (_a = o.metadata) != null ? _a : { format: "unknown" },
    originalData: o.originalData != null ? String(o.originalData) : void 0
  };
}
function serializeParsed(doc) {
  var _a, _b, _c, _d;
  const o = doc;
  return {
    _id: String(o._id),
    attachmentId: String(o.attachmentId),
    emailId: String(o.emailId),
    documentType: o.documentType,
    extractedAt: (o.extractedAt instanceof Date ? o.extractedAt : /* @__PURE__ */ new Date()).toISOString(),
    format: o.format,
    rowsProcessed: Number((_a = o.rowsProcessed) != null ? _a : 0),
    rowsValid: Number((_b = o.rowsValid) != null ? _b : 0),
    rowsFailed: Number((_c = o.rowsFailed) != null ? _c : 0),
    data: o.data,
    mapping: (_d = o.mapping) != null ? _d : {},
    validationErrors: o.validationErrors
  };
}
async function listEmails(page, limit, filters) {
  const db = await getDb();
  const col = db.collection(INBOX_COLLECTIONS.inboxEmail);
  const skip = (page - 1) * limit;
  const mongoFilter = {};
  if (filters.status) mongoFilter.status = filters.status;
  if (filters.from) mongoFilter.from = filters.from;
  if (filters.archived !== void 0) {
    mongoFilter.archived = filters.archived;
  } else {
    mongoFilter.archived = false;
  }
  if (filters.dateFrom || filters.dateTo) {
    mongoFilter.receivedAt = {};
    if (filters.dateFrom) {
      mongoFilter.receivedAt.$gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      mongoFilter.receivedAt.$lte = filters.dateTo;
    }
  }
  const [emails, total] = await Promise.all([
    col.find(mongoFilter).sort({ receivedAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(mongoFilter)
  ]);
  const emailIds = emails.map((e) => e._id);
  const attachmentCounts = emailIds.length > 0 ? await db.collection(INBOX_COLLECTIONS.emailAttachment).aggregate([
    { $match: { emailId: { $in: emailIds } } },
    {
      $group: {
        _id: "$emailId",
        count: { $sum: 1 },
        parsedCount: {
          $sum: { $cond: [{ $eq: ["$parseStatus", "success"] }, 1, 0] }
        }
      }
    }
  ]).toArray() : [];
  const countMap = new Map(
    attachmentCounts.map((ac) => [
      ac._id.toString(),
      { total: ac.count, parsed: ac.parsedCount }
    ])
  );
  const emailsOut = emails.map((email) => {
    const base = serializeEmail(email);
    const stats = countMap.get(String(email._id));
    return {
      ...base,
      attachmentStats: stats || { total: 0, parsed: 0 }
    };
  });
  return {
    emails: emailsOut,
    total,
    hasMore: skip + limit < total,
    page,
    limit
  };
}
async function getEmailWithAttachments(id) {
  const db = await getDb();
  const emailCol = db.collection(INBOX_COLLECTIONS.inboxEmail);
  const attCol = db.collection(INBOX_COLLECTIONS.emailAttachment);
  const parsedCol = db.collection(INBOX_COLLECTIONS.parsedData);
  let _id;
  try {
    _id = oid(id);
  } catch {
    return null;
  }
  const email = await emailCol.findOne({ _id });
  if (!email) return null;
  const attachments = await attCol.find({ emailId: _id }).toArray();
  const parsedIds = attachments.map((a) => a.parsedDataRef).filter((x) => x instanceof ObjectId);
  const parsedMap = /* @__PURE__ */ new Map();
  if (parsedIds.length > 0) {
    const parsedDocs = await parsedCol.find({ _id: { $in: parsedIds } }).toArray();
    parsedDocs.forEach((pd) => {
      parsedMap.set(String(pd._id), serializeParsed(pd));
    });
  }
  const attachmentsOut = attachments.map((att) => {
    const base = serializeAttachment(att);
    const pdRef = att.parsedDataRef;
    return {
      ...base,
      parsedData: pdRef ? parsedMap.get(String(pdRef)) : void 0
    };
  });
  return {
    email: serializeEmail(email),
    attachments: attachmentsOut
  };
}
async function findEmailByMessageId(messageId) {
  const db = await getDb();
  return db.collection(INBOX_COLLECTIONS.inboxEmail).findOne({ messageId });
}
async function insertEmail(dto, opts) {
  var _a, _b;
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  const doc = {
    messageId: dto.messageId,
    from: dto.from,
    subject: dto.subject,
    receivedAt: dto.receivedAt,
    storedAt: now,
    status: (_a = opts == null ? void 0 : opts.status) != null ? _a : "received",
    hasAttachments: dto.hasAttachments,
    attachmentCount: dto.attachmentCount,
    summary: dto.summary,
    retryCount: 0,
    archived: false,
    metadata: (_b = dto.metadata) != null ? _b : {},
    created_at: now,
    updated_at: now
  };
  const r = await db.collection(INBOX_COLLECTIONS.inboxEmail).insertOne(doc);
  return { _id: r.insertedId };
}
async function insertAttachment(emailId, dto, extra) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  const doc = {
    emailId,
    fileName: dto.fileName,
    mimeType: dto.mimeType,
    fileSize: dto.fileSize,
    googleAttachmentId: dto.googleAttachmentId,
    downloadedAt: now,
    storedLocally: false,
    documentType: (_b = (_a = extra == null ? void 0 : extra.documentType) != null ? _a : dto.documentType) != null ? _b : "other",
    parseStatus: (_c = extra == null ? void 0 : extra.parseStatus) != null ? _c : "pending",
    parseError: extra == null ? void 0 : extra.parseError,
    metadata: {
      format: (_e = (_d = dto.metadata) == null ? void 0 : _d.format) != null ? _e : "unknown",
      sheets: (_f = dto.metadata) == null ? void 0 : _f.sheets,
      delimiter: (_g = dto.metadata) == null ? void 0 : _g.delimiter
    },
    originalData: (_h = extra == null ? void 0 : extra.originalData) != null ? _h : dto.originalData,
    created_at: now,
    updated_at: now
  };
  const r = await db.collection(INBOX_COLLECTIONS.emailAttachment).insertOne(doc);
  return { _id: r.insertedId };
}
async function insertParsedData(dto) {
  var _a;
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
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
    mapping: (_a = dto.mapping) != null ? _a : {},
    validationErrors: dto.validationErrors,
    created_at: now,
    updated_at: now
  };
  const r = await db.collection(INBOX_COLLECTIONS.parsedData).insertOne(doc);
  return { _id: r.insertedId };
}
async function updateAttachment(id, patch) {
  const db = await getDb();
  const $set = { ...patch, updated_at: /* @__PURE__ */ new Date() };
  if (patch.parsedDataRef !== void 0) {
    $set.parsedDataRef = patch.parsedDataRef;
  }
  await db.collection(INBOX_COLLECTIONS.emailAttachment).updateOne({ _id: oid(id) }, { $set });
}
async function updateEmail(id, patch) {
  const db = await getDb();
  await db.collection(INBOX_COLLECTIONS.inboxEmail).updateOne({ _id: oid(id) }, { $set: { ...patch, updated_at: /* @__PURE__ */ new Date() } });
}
async function updateParsedData(id, patch) {
  const db = await getDb();
  await db.collection(INBOX_COLLECTIONS.parsedData).updateOne({ _id: oid(id) }, { $set: { ...patch, updated_at: /* @__PURE__ */ new Date() } });
}
async function insertProcessingLog(dto) {
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  await db.collection(INBOX_COLLECTIONS.processingLog).insertOne({
    emailId: dto.emailId ? oid(dto.emailId) : void 0,
    attachmentId: dto.attachmentId ? oid(dto.attachmentId) : void 0,
    eventType: dto.eventType,
    status: dto.status,
    message: dto.message,
    timestamp: now,
    duration: dto.duration,
    details: dto.details,
    created_at: now
  });
}
async function countUnprocessedAttachments() {
  const db = await getDb();
  return db.collection(INBOX_COLLECTIONS.emailAttachment).countDocuments({
    parseStatus: { $ne: "success" }
  });
}
async function findAttachmentsByEmail(emailId, filter) {
  const db = await getDb();
  return db.collection(INBOX_COLLECTIONS.emailAttachment).find({ emailId, ...filter }).toArray();
}
async function getEmailDocById(id) {
  const db = await getDb();
  try {
    return db.collection(INBOX_COLLECTIONS.inboxEmail).findOne({ _id: oid(id) });
  } catch {
    return null;
  }
}

export { updateAttachment as a, updateParsedData as b, insertProcessingLog as c, getEmailDocById as d, findEmailByMessageId as e, findAttachmentsByEmail as f, getEmailWithAttachments as g, insertEmail as h, insertParsedData as i, insertAttachment as j, countUnprocessedAttachments as k, listEmails as l, updateEmail as u };
//# sourceMappingURL=inboxRepository.mjs.map
