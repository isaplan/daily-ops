import { d as documentParserService } from './documentParserService.mjs';
import { i as isTestDataType, s as storeRawData, d as dataMappingService } from './rawDataStorageService.mjs';
import { g as gmailApiService } from './gmailApiService.mjs';
import { f as findAttachmentsByEmail, u as updateEmail, a as updateAttachment, i as insertParsedData, b as updateParsedData, c as insertProcessingLog, d as getEmailDocById } from './inboxRepository.mjs';
import { Buffer } from 'node:buffer';

async function handleParsedMapping(parseResult, attachmentId, emailId, parsedDataId) {
  if (!parseResult.documentType) return;
  const base = {
    attachmentId,
    emailId,
    documentType: parseResult.documentType,
    format: parseResult.format,
    rowsProcessed: parseResult.rowCount,
    rowsValid: parseResult.rowCount,
    rowsFailed: 0,
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
          metadata: parseResult.metadata
        }
      });
      await updateAttachment(attId, { parsedDataRef: parsedInsert._id });
      await handleParsedMapping(parseResult, attId, emailId, parsedInsert._id);
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
  var _a, _b, _c, _d;
  const { getDb } = await import('../nitro/nitro.mjs').then(function (n) { return n.aa; });
  const { INBOX_COLLECTIONS } = await import('../nitro/nitro.mjs').then(function (n) { return n.ab; });
  const db = await getDb();
  const col = db.collection(INBOX_COLLECTIONS.inboxEmail);
  const emails = await col.find({
    $or: [{ status: { $ne: "completed" } }, { status: { $exists: false } }]
  }).sort({ receivedAt: -1 }).limit(maxEmails).toArray();
  let totalProcessed = 0;
  let totalFailed = 0;
  const results = [];
  for (const email of emails) {
    const emailIdStr = String(email._id);
    const unprocessed = await findAttachmentsByEmail(email._id, {
      parseStatus: { $ne: "success" }
    });
    if (unprocessed.length === 0) {
      await updateEmail(emailIdStr, { status: "completed" });
      continue;
    }
    const messageId = String(email.messageId);
    await updateEmail(emailIdStr, { status: "processing", lastAttempt: /* @__PURE__ */ new Date() });
    let attachmentsProcessed = 0;
    let attachmentsFailed = 0;
    for (const attachment of unprocessed) {
      const attId = String(attachment._id);
      try {
        await updateAttachment(attId, { parseStatus: "parsing" });
        const gmailAttachment = await gmailApiService.downloadAttachment(
          messageId,
          String(attachment.googleAttachmentId)
        );
        if (!gmailAttachment.data) {
          throw new Error("Failed to download attachment data");
        }
        const fileBuffer = Buffer.from(gmailAttachment.data, "base64");
        const lowerName = String(attachment.fileName).toLowerCase();
        const lowerMime = String(attachment.mimeType).toLowerCase();
        const isHtml = lowerName.endsWith(".html") || lowerName.endsWith(".htm") || lowerMime.includes("text/html");
        if (isHtml) {
          await updateAttachment(attId, {
            parseStatus: "success",
            documentType: "other",
            metadata: { ...attachment.metadata, format: "unknown" }
          });
          attachmentsProcessed++;
          continue;
        }
        const isCsvByMimeOrExt = lowerMime.includes("csv") || lowerName.endsWith(".csv");
        const parseResult = await documentParserService.parseDocument({
          fileName: String(attachment.fileName),
          mimeType: String(attachment.mimeType),
          data: isCsvByMimeOrExt ? fileBuffer.toString("utf-8") : fileBuffer,
          autoDetectType: true
        });
        if (!parseResult.success || !parseResult.documentType) {
          await updateAttachment(attId, {
            parseStatus: "failed",
            parseError: parseResult.error || "Parsing failed"
          });
          attachmentsFailed++;
          continue;
        }
        const meta = (_a = attachment.metadata) != null ? _a : {};
        await updateAttachment(attId, {
          documentType: parseResult.documentType,
          metadata: {
            format: parseResult.format,
            sheets: (_b = parseResult.metadata) == null ? void 0 : _b.sheets,
            delimiter: (_c = parseResult.metadata) == null ? void 0 : _c.delimiter,
            rowCount: parseResult.rowCount,
            columnCount: parseResult.headers.length,
            userInfo: (_d = parseResult.metadata) == null ? void 0 : _d.userInfo,
            ...meta
          }
        });
        const parsedInsert = await insertParsedData({
          attachmentId: attId,
          emailId: emailIdStr,
          documentType: parseResult.documentType,
          format: parseResult.format,
          rowsProcessed: parseResult.rowCount,
          rowsValid: parseResult.rowCount,
          rowsFailed: 0,
          data: {
            headers: parseResult.headers,
            rows: parseResult.rows,
            metadata: parseResult.metadata
          }
        });
        await updateAttachment(attId, { parsedDataRef: parsedInsert._id });
        if (isTestDataType(parseResult.documentType)) {
          const rawStorageResult = await storeRawData(
            {
              attachmentId: attId,
              emailId: emailIdStr,
              documentType: parseResult.documentType,
              format: parseResult.format,
              rowsProcessed: parseResult.rowCount,
              rowsValid: parseResult.rowCount,
              rowsFailed: 0,
              data: {
                headers: parseResult.headers,
                rows: parseResult.rows,
                metadata: parseResult.metadata
              }
            },
            parseResult.documentType,
            { fileName: String(attachment.fileName) }
          );
          await updateParsedData(String(parsedInsert._id), {
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
          const mappingResult = await dataMappingService.mapToCollection(
            {
              attachmentId: attId,
              emailId: emailIdStr,
              documentType: parseResult.documentType,
              format: parseResult.format,
              rowsProcessed: parseResult.rowCount,
              rowsValid: parseResult.rowCount,
              rowsFailed: 0,
              data: {
                headers: parseResult.headers,
                rows: parseResult.rows
              }
            },
            parseResult.documentType
          );
          await updateParsedData(String(parsedInsert._id), {
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
        }
        await updateAttachment(attId, { parseStatus: "success" });
        await insertProcessingLog({
          emailId: emailIdStr,
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
          emailId: emailIdStr,
          attachmentId: attId,
          eventType: "error",
          status: "error",
          message: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`
        });
        attachmentsFailed++;
      }
    }
    await updateEmail(emailIdStr, {
      status: attachmentsFailed === 0 ? "completed" : "failed",
      processedAt: /* @__PURE__ */ new Date()
    });
    if (attachmentsProcessed > 0) {
      totalProcessed++;
      results.push({
        emailId: emailIdStr,
        success: attachmentsFailed === 0,
        attachmentsProcessed
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

export { processEmailAttachments as a, processAllUnprocessed as p };
//# sourceMappingURL=inboxProcessService.mjs.map
