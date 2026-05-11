import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import { d as documentParserService } from './documentParserService.mjs';
import { i as isTestDataType, s as storeRawData, d as dataMappingService } from './rawDataStorageService.mjs';
import { google } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/googleapis@171.4.0/node_modules/googleapis/build/src/index.js';
import { g as getGmailRefreshToken } from './gmailOAuthService.mjs';
import { g as getGmailRedirectUri, a as getDb, ah as matchVenueLocationFromText, ac as mapBasisReportXLSX } from '../nitro/nitro.mjs';
import { j as getEmailDocById, e as updateEmail, k as findAttachmentsByEmail, u as updateAttachment, h as insertProcessingLog, b as insertParsedData, d as updateParsedData } from './inboxRepository.mjs';
import { Buffer } from 'node:buffer';

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class GmailApiService {
  constructor() {
    __publicField(this, "gmail", null);
    __publicField(this, "auth", null);
  }
  async initialize() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET missing"
      );
    }
    let refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    if (!refreshToken) {
      refreshToken = await getGmailRefreshToken();
    }
    if (!refreshToken) {
      throw new Error(
        "No refresh token found. Connect Gmail using the UI first."
      );
    }
    const redirectUri = getGmailRedirectUri();
    console.log("[gmailApiService] Initializing with:");
    console.log("  - clientId:", clientId.slice(0, 20) + "...");
    console.log("  - redirectUri:", redirectUri);
    console.log("  - refreshToken:", refreshToken.slice(0, 20) + "...");
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    this.auth = oauth2Client;
    this.gmail = google.gmail({ version: "v1", auth: oauth2Client });
  }
  async ensureInitialized() {
    if (!this.gmail || !this.auth) {
      await this.initialize();
    }
  }
  async fetchEmails(options = {}) {
    var _a, _b;
    await this.ensureInitialized();
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }
    const envQuery = (_a = process.env.GMAIL_SYNC_QUERY) == null ? void 0 : _a.trim();
    const query = options.query || envQuery || "in:inbox";
    try {
      const response = await this.gmail.users.messages.list({
        userId: "me",
        maxResults: options.maxResults || 50,
        q: query,
        pageToken: options.pageToken
      });
      const messageIds = ((_b = response.data.messages) == null ? void 0 : _b.map((msg) => msg.id || "").filter(Boolean)) || [];
      if (messageIds.length === 0) {
        return {
          messages: [],
          nextPageToken: response.data.nextPageToken || void 0,
          resultSizeEstimate: response.data.resultSizeEstimate || 0
        };
      }
      const messagePromises = messageIds.map((id) => this.getMessage(id));
      const messages = await Promise.all(messagePromises);
      return {
        messages: messages.filter((msg) => msg !== null),
        nextPageToken: response.data.nextPageToken || void 0,
        resultSizeEstimate: response.data.resultSizeEstimate || 0
      };
    } catch (err) {
      console.error("[gmailApiService] fetchEmails error:", err);
      throw err;
    }
  }
  async getMessage(messageId) {
    await this.ensureInitialized();
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }
    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full"
      });
      const message = response.data;
      if (!message.id) {
        return null;
      }
      return {
        id: message.id,
        threadId: message.threadId || "",
        labelIds: message.labelIds || [],
        snippet: message.snippet || "",
        historyId: message.historyId || "",
        payload: message.payload,
        sizeEstimate: message.sizeEstimate || 0,
        internalDate: message.internalDate || ""
      };
    } catch {
      return null;
    }
  }
  async downloadAttachment(messageId, attachmentId) {
    await this.ensureInitialized();
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }
    const response = await this.gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId
    });
    return {
      attachmentId: response.data.id || attachmentId,
      size: parseInt(response.data.size || "0", 10),
      data: response.data.data || void 0
    };
  }
}
const gmailApiService = new GmailApiService();

async function aggregateDailySalesForEmail(emailId, db) {
  const database = await getDb();
  const salesRows = await database.collection("bork_sales").find({ source: "inbox", sourceEmailId: emailId }).toArray();
  if (salesRows.length === 0) return;
  const groupKey = {};
  for (const row of salesRows) {
    const dateStr = row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date);
    const locStr = String(row.location_name || "unknown");
    const key = `${dateStr}|${locStr}`;
    if (!groupKey[key]) groupKey[key] = [];
    groupKey[key].push(row);
  }
  const dailyDocs = [];
  const now = /* @__PURE__ */ new Date();
  for (const [key, rows] of Object.entries(groupKey)) {
    const [dateStr, locationName] = key.split("|");
    const [year, month, day] = dateStr.split("-").map((x) => parseInt(x, 10));
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
    const itemCount = rows.length;
    dailyDocs.push({
      date,
      location_name: locationName === "unknown" ? null : locationName,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      item_count: itemCount,
      email_received_at: now,
      source_emails: [emailId],
      created_at: now,
      updated_at: now
    });
  }
  const dailyCollection = database.collection("bork_sales_daily");
  for (const doc of dailyDocs) {
    await dailyCollection.updateOne(
      { date: doc.date, location_name: doc.location_name },
      {
        $set: {
          total_revenue: doc.total_revenue,
          item_count: doc.item_count,
          email_received_at: doc.email_received_at,
          updated_at: now
        },
        $addToSet: { source_emails: emailId },
        $setOnInsert: {
          created_at: now
        }
      },
      { upsert: true }
    );
  }
}

async function handleParsedMapping(parseResult, attachmentId, emailId, parsedDataId, emailData) {
  var _a, _b;
  const db = await getDb();
  if (!parseResult.documentType) return;
  const base = {
    attachmentId,
    emailId,
    documentType: parseResult.documentType,
    format: parseResult.format,
    rowsProcessed: parseResult.rowCount,
    rowsValid: parseResult.rowCount,
    rowsFailed: 0,
    sourceEmailReceivedAt: (_a = emailData == null ? void 0 : emailData.receivedAt) != null ? _a : null,
    sourceAttachmentFileName: ((_b = emailData == null ? void 0 : emailData.fileName) == null ? void 0 : _b.trim()) || null,
    data: {
      headers: parseResult.headers,
      rows: parseResult.rows,
      metadata: parseResult.metadata
    }
  };
  if (isTestDataType(parseResult.documentType)) {
    const rawStorageResult = await storeRawData(base, parseResult.documentType, {});
    await updateParsedData(String(parsedDataId), {
      mapping: {
        mappedToCollection: rawStorageResult.collectionName,
        matchedRecords: 0,
        createdRecords: rawStorageResult.recordsCreated,
        updatedRecords: 0
      },
      rowsValid: rawStorageResult.recordsCreated,
      rowsFailed: rawStorageResult.recordsFailed,
      validationErrors: rawStorageResult.errors.map((e) => ({
        row: e.row,
        column: "",
        error: e.error
      }))
    });
  } else if (parseResult.documentType !== "formitabele" && parseResult.documentType !== "pasy" && parseResult.documentType !== "coming_soon") {
    if (parseResult.documentType === "basis_report" || parseResult.format === "xlsx") {
      const basisReport = await mapBasisReportXLSX(
        parseResult,
        (emailData == null ? void 0 : emailData.fileName) || "",
        emailData,
        db
      );
      if (basisReport) {
        const attKey = emailData == null ? void 0 : emailData.attachmentId;
        const filter = attKey ? { "metadata.source_attachment_id": attKey } : { date: basisReport.date, location: basisReport.location };
        await db.collection("inbox-bork-basis-report").updateOne(
          filter,
          { $set: { ...basisReport, updated_at: /* @__PURE__ */ new Date() } },
          { upsert: true }
        );
        await updateParsedData(String(parsedDataId), {
          mapping: {
            mappedToCollection: "inbox-bork-basis-report",
            matchedRecords: 1,
            createdRecords: 1,
            updatedRecords: 0
          },
          rowsValid: 1,
          rowsFailed: 0
        });
      }
    } else {
      const mappingResult = await dataMappingService.mapToCollection(
        {
          ...base,
          data: { headers: parseResult.headers, rows: parseResult.rows }
        },
        parseResult.documentType
      );
      await updateParsedData(String(parsedDataId), {
        mapping: {
          mappedToCollection: mappingResult.mappedToCollection,
          matchedRecords: mappingResult.matchedRecords,
          createdRecords: mappingResult.createdRecords,
          updatedRecords: mappingResult.updatedRecords
        },
        rowsValid: mappingResult.createdRecords + mappingResult.updatedRecords,
        rowsFailed: mappingResult.failedRecords,
        validationErrors: mappingResult.errors.map((e) => ({
          row: e.row,
          column: "",
          error: e.error
        }))
      });
      if (parseResult.documentType === "sales") {
        try {
          const emailOid = new ObjectId(emailId);
          await aggregateDailySalesForEmail(emailOid);
        } catch (error) {
          console.error("[inboxProcessService] Failed to aggregate daily sales:", error);
        }
      }
    }
  }
}
async function processEmailAttachments(emailId) {
  var _a, _b, _c, _d, _e, _f;
  const email = await getEmailDocById(emailId);
  if (!email) {
    throw new Error("Email not found");
  }
  const messageId = String(email.messageId);
  const eid = email._id;
  await updateEmail(emailId, {
    status: "processing",
    lastAttempt: /* @__PURE__ */ new Date()
  });
  const attachments = await findAttachmentsByEmail(eid, { parseStatus: { $ne: "success" } });
  let attachmentsProcessed = 0;
  let attachmentsFailed = 0;
  for (const attachment of attachments) {
    const attId = String(attachment._id);
    try {
      await updateAttachment(attId, { parseStatus: "parsing" });
      const lowerName = String((_a = attachment.fileName) != null ? _a : "").toLowerCase();
      const lowerMime = String((_b = attachment.mimeType) != null ? _b : "").toLowerCase();
      const isHtml = lowerName.endsWith(".html") || lowerName.endsWith(".htm") || lowerMime.includes("text/html");
      if (isHtml) {
        await updateAttachment(attId, {
          parseStatus: "success",
          documentType: "other",
          metadata: {
            ...attachment.metadata,
            format: "unknown"
          }
        });
        attachmentsProcessed++;
        continue;
      }
      let parseData;
      const isCsv = lowerMime.includes("csv") || lowerName.endsWith(".csv");
      const originalData = attachment.originalData != null ? String(attachment.originalData) : void 0;
      if (originalData) {
        parseData = isCsv ? originalData : Buffer.from(originalData, "base64");
      } else {
        const gmailAttachment = await gmailApiService.downloadAttachment(
          messageId,
          String(attachment.googleAttachmentId)
        );
        if (!gmailAttachment.data) {
          throw new Error("Failed to download attachment data");
        }
        const fileBuffer = Buffer.from(gmailAttachment.data, "base64");
        parseData = isCsv ? fileBuffer.toString("utf-8") : fileBuffer;
        await updateAttachment(attId, {
          originalData: isCsv ? parseData : fileBuffer.toString("base64")
        });
      }
      const parseResult = await documentParserService.parseDocument({
        fileName: String(attachment.fileName),
        mimeType: String(attachment.mimeType),
        data: parseData,
        autoDetectType: true
      });
      if (!parseResult.success || !parseResult.documentType) {
        await updateAttachment(attId, {
          parseStatus: "failed",
          parseError: parseResult.error || "Parsing failed"
        });
        await insertProcessingLog({
          emailId,
          attachmentId: attId,
          eventType: "parse",
          status: "error",
          message: `Failed to parse attachment: ${parseResult.error}`
        });
        attachmentsFailed++;
        continue;
      }
      const emailMetadata = {};
      if (email.subject) {
        const dateMatch = email.subject.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
          const [, d, m, y] = dateMatch;
          emailMetadata.extracted_date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        }
        const subjectLocation = matchVenueLocationFromText(email.subject);
        if (subjectLocation) {
          emailMetadata.extracted_location = subjectLocation;
        }
        emailMetadata.email_subject = email.subject;
      }
      const meta = (_c = attachment.metadata) != null ? _c : {};
      await updateAttachment(attId, {
        documentType: parseResult.documentType,
        metadata: {
          format: parseResult.format,
          sheets: (_d = parseResult.metadata) == null ? void 0 : _d.sheets,
          delimiter: (_e = parseResult.metadata) == null ? void 0 : _e.delimiter,
          rowCount: parseResult.rowCount,
          columnCount: parseResult.headers.length,
          userInfo: (_f = parseResult.metadata) == null ? void 0 : _f.userInfo,
          ...meta
        }
      });
      const parsedInsert = await insertParsedData({
        attachmentId: attId,
        emailId,
        documentType: parseResult.documentType,
        format: parseResult.format,
        rowsProcessed: parseResult.rowCount,
        rowsValid: parseResult.rowCount,
        rowsFailed: 0,
        data: {
          headers: parseResult.headers,
          rows: parseResult.rows,
          metadata: { ...parseResult.metadata, ...emailMetadata }
        }
      });
      await updateAttachment(attId, { parsedDataRef: parsedInsert._id });
      await handleParsedMapping(
        parseResult,
        attId,
        emailId,
        parsedInsert._id,
        {
          emailId,
          subject: email.subject,
          receivedAt: email.receivedAt,
          fileName: String(attachment.fileName),
          messageId,
          attachmentId: attId
        }
      );
      await updateAttachment(attId, { parseStatus: "success" });
      await insertProcessingLog({
        emailId,
        attachmentId: attId,
        eventType: "store",
        status: "success",
        message: `Successfully parsed and stored ${parseResult.rowCount} rows`
      });
      attachmentsProcessed++;
    } catch (error) {
      await updateAttachment(attId, {
        parseStatus: "failed",
        parseError: error instanceof Error ? error.message : "Unknown error"
      });
      await insertProcessingLog({
        emailId,
        attachmentId: attId,
        eventType: "error",
        status: "error",
        message: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      });
      attachmentsFailed++;
    }
  }
  await updateEmail(emailId, {
    status: attachmentsFailed === 0 ? "completed" : "failed",
    processedAt: /* @__PURE__ */ new Date()
  });
  return {
    success: attachmentsFailed === 0,
    attachmentsProcessed,
    attachmentsFailed
  };
}
async function processAllUnprocessed(maxEmails) {
  const { INBOX_COLLECTIONS } = await import('../nitro/nitro.mjs').then(function (n) { return n.as; });
  const db = await getDb();
  const emails = await db.collection(INBOX_COLLECTIONS.inboxEmail).find({
    $or: [{ status: { $ne: "completed" } }, { status: { $exists: false } }]
  }).sort({ receivedAt: -1 }).limit(maxEmails).toArray();
  let totalProcessed = 0;
  let totalFailed = 0;
  const results = [];
  for (const email of emails) {
    const emailIdStr = String(email._id);
    try {
      const result = await processEmailAttachments(emailIdStr);
      if (result.attachmentsProcessed > 0) {
        totalProcessed++;
        results.push({
          emailId: emailIdStr,
          success: result.success,
          attachmentsProcessed: result.attachmentsProcessed
        });
      } else {
        totalFailed++;
        results.push({
          emailId: emailIdStr,
          success: false,
          attachmentsProcessed: 0,
          error: "No attachments processed"
        });
      }
    } catch (error) {
      totalFailed++;
      results.push({
        emailId: emailIdStr,
        success: false,
        attachmentsProcessed: 0,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
  const total = emails.length;
  let message;
  if (total === 0) {
    message = "No emails to process. Sync inbox first to fetch emails, or all emails are already completed.";
  } else if (totalProcessed === 0 && totalFailed === 0) {
    message = "No unprocessed attachments found. All checked emails are already up to date.";
  } else if (totalProcessed === 0 && totalFailed > 0) {
    message = `No attachments could be processed. ${totalFailed} email(s) had errors.`;
  } else if (totalFailed > 0) {
    message = `${totalProcessed} email(s) processed, ${totalFailed} failed.`;
  } else {
    message = `Processed ${totalProcessed} email(s) successfully.`;
  }
  return {
    emailsProcessed: totalProcessed,
    emailsFailed: totalFailed,
    total,
    message,
    results
  };
}

const inboxProcessService = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  processAllUnprocessed: processAllUnprocessed,
  processEmailAttachments: processEmailAttachments
}, Symbol.toStringTag, { value: 'Module' }));

export { processEmailAttachments as a, gmailApiService as g, inboxProcessService as i, processAllUnprocessed as p };
//# sourceMappingURL=inboxProcessService.mjs.map
