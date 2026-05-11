import { defineEventHandler, readMultipartFormData, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { Buffer } from 'node:buffer';
import { K as ensureInboxCollections, L as ensureInboxIndexes } from '../../../nitro/nitro.mjs';
import { d as documentParserService } from '../../../_/documentParserService.mjs';
import { i as isTestDataType, s as storeRawData, d as dataMappingService } from '../../../_/rawDataStorageService.mjs';
import { i as insertEmail, a as insertAttachment, b as insertParsedData, u as updateAttachment, d as updateParsedData, e as updateEmail } from '../../../_/inboxRepository.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/papaparse@5.5.3/node_modules/papaparse/papaparse.js';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'node:fs';
import 'node:stream';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/destr/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/nitropack/node_modules/hookable/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ofetch/dist/node.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/node-mock-http/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs.mjs';
import 'node:crypto';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs-lite.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/lru-cache.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ohash/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/klona/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/defu/dist/defu.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/scule/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unctx/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/radix3/dist/index.mjs';
import 'node:path';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/googleapis@171.4.0/node_modules/googleapis/build/src/index.js';
import 'node:http';
import 'node:https';
import 'node:url';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/pathe/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/@iconify/utils/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/consola/dist/index.mjs';
import 'node:module';

const MAX = 10 * 1024 * 1024;
const upload_post = defineEventHandler(async (event) => {
  var _a, _b, _c, _d;
  try {
    await ensureInboxCollections();
    await ensureInboxIndexes();
    const form = await readMultipartFormData(event);
    const file = form == null ? void 0 : form.find((f) => f.name === "file" && f.data && f.filename);
    if (!(file == null ? void 0 : file.data) || !file.filename) {
      return { success: false, error: "No file provided" };
    }
    if (file.data.length > MAX) {
      return { success: false, error: "File size exceeds 10MB limit" };
    }
    const buffer = Buffer.from(file.data);
    const mime = file.type || "application/octet-stream";
    const isCsv = mime.includes("csv") || file.filename.toLowerCase().endsWith(".csv");
    const originalData = isCsv ? buffer.toString("utf-8") : buffer.toString("base64");
    const parseResult = await documentParserService.parseDocument({
      fileName: file.filename,
      mimeType: mime,
      data: isCsv ? buffer.toString("utf-8") : buffer,
      autoDetectType: true
    });
    if (!parseResult.success) {
      const manualMessageId = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const { _id: emailId2 } = await insertEmail(
        {
          messageId: manualMessageId,
          from: "manual_upload@system",
          subject: `Manual Upload: ${file.filename}`,
          receivedAt: /* @__PURE__ */ new Date(),
          hasAttachments: true,
          attachmentCount: 1,
          summary: `Manually uploaded file: ${file.filename} (parse failed)`
        },
        { status: "failed" }
      );
      const attachId = `manual_${Date.now()}`;
      const failedAttachment = await insertAttachment(
        emailId2,
        {
          emailId: String(emailId2),
          fileName: file.filename,
          mimeType: mime,
          fileSize: file.data.length,
          googleAttachmentId: attachId,
          metadata: { format: parseResult.format === "html" ? "unknown" : parseResult.format }
        },
        {
          parseStatus: "failed",
          documentType: "other",
          parseError: parseResult.error || "Failed to parse file",
          originalData
        }
      );
      return {
        success: true,
        data: {
          email: { _id: String(emailId2), messageId: manualMessageId, subject: `Manual Upload: ${file.filename}` },
          attachment: { _id: String(failedAttachment._id) },
          parseFailed: true,
          error: parseResult.error
        }
      };
    }
    const manualMessageIdOk = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const { _id: emailId } = await insertEmail({
      messageId: manualMessageIdOk,
      from: "manual_upload@system",
      subject: `Manual Upload: ${file.filename}`,
      receivedAt: /* @__PURE__ */ new Date(),
      hasAttachments: true,
      attachmentCount: 1,
      summary: `Manually uploaded file: ${file.filename}`
    });
    const docType = (_a = parseResult.documentType) != null ? _a : "other";
    const attachIdOk = `manual_${Date.now()}`;
    const attachmentIns = await insertAttachment(
      emailId,
      {
        emailId: String(emailId),
        fileName: file.filename,
        mimeType: mime,
        fileSize: file.data.length,
        googleAttachmentId: attachIdOk,
        documentType: docType,
        metadata: {
          format: parseResult.format,
          sheets: (_b = parseResult.metadata) == null ? void 0 : _b.sheets,
          delimiter: (_c = parseResult.metadata) == null ? void 0 : _c.delimiter,
          rowCount: parseResult.rowCount,
          columnCount: parseResult.headers.length,
          userInfo: (_d = parseResult.metadata) == null ? void 0 : _d.userInfo
        }
      },
      { parseStatus: "success", originalData, documentType: docType }
    );
    const parsedInsert = await insertParsedData({
      attachmentId: String(attachmentIns._id),
      emailId: String(emailId),
      documentType: docType,
      format: parseResult.format === "html" ? "unknown" : parseResult.format,
      rowsProcessed: parseResult.rowCount,
      rowsValid: parseResult.rowCount,
      rowsFailed: 0,
      data: {
        headers: parseResult.headers,
        rows: parseResult.rows,
        metadata: parseResult.metadata
      }
    });
    await updateAttachment(String(attachmentIns._id), {
      parsedDataRef: parsedInsert._id
    });
    let mappingResult = null;
    if (parseResult.documentType && isTestDataType(parseResult.documentType)) {
      const rawStorageResult = await storeRawData(
        {
          attachmentId: String(attachmentIns._id),
          emailId: String(emailId),
          documentType: parseResult.documentType,
          format: parseResult.format === "html" ? "unknown" : parseResult.format,
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
        { fileName: file.filename }
      );
      mappingResult = {
        success: rawStorageResult.recordsCreated > 0,
        mappedToCollection: rawStorageResult.collectionName,
        matchedRecords: 0,
        createdRecords: rawStorageResult.recordsCreated,
        updatedRecords: 0,
        failedRecords: rawStorageResult.recordsFailed,
        errors: rawStorageResult.errors
      };
      await updateParsedData(String(parsedInsert._id), {
        mapping: {
          mappedToCollection: rawStorageResult.collectionName,
          matchedRecords: 0,
          createdRecords: rawStorageResult.recordsCreated,
          updatedRecords: 0
        },
        rowsValid: rawStorageResult.recordsCreated,
        rowsFailed: rawStorageResult.recordsFailed
      });
    } else if (parseResult.documentType && parseResult.documentType !== "formitabele" && parseResult.documentType !== "pasy" && parseResult.documentType !== "coming_soon") {
      const mr = await dataMappingService.mapToCollection(
        {
          attachmentId: String(attachmentIns._id),
          emailId: String(emailId),
          documentType: parseResult.documentType,
          format: parseResult.format === "html" ? "unknown" : parseResult.format,
          rowsProcessed: parseResult.rowCount,
          rowsValid: parseResult.rowCount,
          rowsFailed: 0,
          sourceAttachmentFileName: file.filename,
          data: {
            headers: parseResult.headers,
            rows: parseResult.rows
          }
        },
        parseResult.documentType
      );
      mappingResult = {
        success: mr.success,
        mappedToCollection: mr.mappedToCollection,
        matchedRecords: mr.matchedRecords,
        createdRecords: mr.createdRecords,
        updatedRecords: mr.updatedRecords,
        failedRecords: mr.failedRecords,
        errors: mr.errors
      };
      await updateParsedData(String(parsedInsert._id), {
        mapping: {
          mappedToCollection: mr.mappedToCollection,
          matchedRecords: mr.matchedRecords,
          createdRecords: mr.createdRecords,
          updatedRecords: mr.updatedRecords
        },
        rowsValid: mr.createdRecords + mr.updatedRecords,
        rowsFailed: mr.failedRecords
      });
    }
    await updateEmail(String(emailId), { status: "completed", processedAt: /* @__PURE__ */ new Date() });
    return {
      success: true,
      data: {
        email: {
          _id: String(emailId),
          messageId: manualMessageIdOk,
          subject: `Manual Upload: ${file.filename}`
        },
        attachment: {
          _id: String(attachmentIns._id),
          fileName: file.filename,
          documentType: docType
        },
        parseResult: {
          format: parseResult.format,
          headers: parseResult.headers,
          rowCount: parseResult.rowCount,
          documentType: parseResult.documentType
        },
        mappingResult
      }
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to upload file"
    });
  }
});

export { upload_post as default };
//# sourceMappingURL=upload.post.mjs.map
