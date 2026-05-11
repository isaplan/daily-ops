import { defineEventHandler, readBody, createError, setResponseStatus } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { Z as gmailWatchService, K as ensureInboxCollections, L as ensureInboxIndexes } from '../../../nitro/nitro.mjs';
import { Buffer } from 'node:buffer';
import { g as gmailApiService, a as processEmailAttachments } from '../../../_/inboxProcessService.mjs';
import { h as insertProcessingLog, f as findEmailByMessageId, i as insertEmail, a as insertAttachment } from '../../../_/inboxRepository.mjs';
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
import '../../../_/documentParserService.mjs';
import '../../../_/rawDataStorageService.mjs';
import '../../../_/gmailOAuthService.mjs';

function isPubSubPushBody(body) {
  if (!body || typeof body !== "object") return false;
  const b = body;
  const msg = b.message;
  if (!msg || typeof msg !== "object") return false;
  const m = msg;
  return typeof m.data === "string" && typeof m.messageId === "string";
}
function parsePubSubPushBody(body) {
  return isPubSubPushBody(body) ? body : null;
}
function decodeGmailNotificationFromBase64(data) {
  const decoded = Buffer.from(data, "base64").toString("utf-8");
  return JSON.parse(decoded);
}
function toStartHistoryId(currentHistoryId) {
  const n = parseInt(currentHistoryId, 10);
  if (Number.isNaN(n) || n < 1) return currentHistoryId;
  return String(n - 1);
}
async function processNewEmails(notificationHistoryId) {
  var _a, _b;
  let emailsCreated = 0;
  let emailsFailed = 0;
  const startHistoryId = toStartHistoryId(notificationHistoryId);
  try {
    const historyRecords = await gmailWatchService.getHistoryAll(startHistoryId, 100);
    const messageIds = /* @__PURE__ */ new Set();
    for (const record of historyRecords) {
      if (record.messagesAdded) {
        for (const msg of record.messagesAdded) {
          if (msg.message.id) messageIds.add(msg.message.id);
        }
      }
      if (record.messages) {
        for (const msg of record.messages) {
          if (msg.id) messageIds.add(msg.id);
        }
      }
    }
    if (messageIds.size === 0) {
      return { emailsCreated: 0, emailsFailed: 0 };
    }
    for (const messageId of messageIds) {
      try {
        const existing = await findEmailByMessageId(messageId);
        if (existing) continue;
        const message = await gmailApiService.getMessage(messageId);
        if (!message) continue;
        const payload = message.payload;
        if (!(payload == null ? void 0 : payload.headers)) continue;
        const fromHeader = payload.headers.find((h) => {
          var _a2;
          return ((_a2 = h.name) == null ? void 0 : _a2.toLowerCase()) === "from";
        });
        const subjectHeader = payload.headers.find((h) => {
          var _a2;
          return ((_a2 = h.name) == null ? void 0 : _a2.toLowerCase()) === "subject";
        });
        const from = (fromHeader == null ? void 0 : fromHeader.value) ? ((_a = fromHeader.value.match(/<([^>]+)>/)) == null ? void 0 : _a[1]) || ((_b = fromHeader.value.match(/(\S+@\S+)/)) == null ? void 0 : _b[1]) || "unknown@unknown.com" : "unknown@unknown.com";
        const subject = (subjectHeader == null ? void 0 : subjectHeader.value) || "(No Subject)";
        const receivedAt = message.internalDate ? new Date(parseInt(message.internalDate, 10)) : /* @__PURE__ */ new Date();
        const summary = message.snippet || "";
        const attachments = [];
        const processPart = (part) => {
          var _a2;
          if (part.filename && ((_a2 = part.body) == null ? void 0 : _a2.attachmentId)) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType || "application/octet-stream",
              size: parseInt(part.body.size || "0", 10),
              attachmentId: part.body.attachmentId
            });
          }
          if (part.parts) part.parts.forEach((p) => processPart(p));
        };
        processPart(payload);
        const { _id: emailId } = await insertEmail({
          messageId: message.id,
          from,
          subject,
          receivedAt,
          summary: summary.substring(0, 500),
          hasAttachments: attachments.length > 0,
          attachmentCount: attachments.length,
          metadata: {
            labels: message.labelIds,
            threadId: message.threadId
          }
        });
        for (const att of attachments) {
          const fmt = att.mimeType.includes("csv") ? "csv" : att.mimeType.includes("spreadsheet") || att.mimeType.includes("excel") ? "xlsx" : att.mimeType.includes("pdf") ? "pdf" : "unknown";
          await insertAttachment(emailId, {
            emailId: String(emailId),
            fileName: att.filename,
            mimeType: att.mimeType,
            fileSize: att.size,
            googleAttachmentId: att.attachmentId,
            metadata: { format: fmt }
          });
        }
        await insertProcessingLog({
          emailId: String(emailId),
          eventType: "fetch",
          status: "success",
          message: `Email fetched via webhook: ${subject}`
        });
        try {
          const proc = await processEmailAttachments(String(emailId));
          await insertProcessingLog({
            emailId: String(emailId),
            eventType: "parse",
            status: proc.success ? "success" : "warning",
            message: `Auto-process after webhook: ${proc.attachmentsProcessed} attachment(s) ok, ${proc.attachmentsFailed} failed`
          });
        } catch (procErr) {
          await insertProcessingLog({
            emailId: String(emailId),
            eventType: "parse",
            status: "error",
            message: `Auto-process after webhook failed: ${procErr instanceof Error ? procErr.message : "unknown"}`
          });
        }
        emailsCreated++;
      } catch {
        emailsFailed++;
        await insertProcessingLog({
          eventType: "fetch",
          status: "error",
          message: "Failed to process email from webhook",
          details: { messageId }
        });
      }
    }
  } catch (error) {
    await insertProcessingLog({
      eventType: "fetch",
      status: "error",
      message: `Failed to process Gmail history: ${error instanceof Error ? error.message : "Unknown error"}`,
      details: { notificationHistoryId, startHistoryId }
    });
  }
  return { emailsCreated, emailsFailed };
}
async function handleInboxPubSubPush(rawBody) {
  var _a;
  const body = parsePubSubPushBody(rawBody);
  if (!((_a = body == null ? void 0 : body.message) == null ? void 0 : _a.data)) {
    return { success: false, statusCode: 400, error: "Invalid request body" };
  }
  let notification;
  try {
    notification = decodeGmailNotificationFromBase64(body.message.data);
  } catch {
    return { success: false, statusCode: 400, error: "Invalid Pub/Sub message data" };
  }
  await insertProcessingLog({
    eventType: "fetch",
    status: "success",
    message: `Webhook received from Gmail (historyId: ${notification.historyId})`,
    details: { historyId: notification.historyId, emailAddress: notification.emailAddress }
  });
  const result = await processNewEmails(notification.historyId);
  return {
    success: true,
    data: {
      messageId: body.message.messageId,
      historyId: notification.historyId,
      emailsCreated: result.emailsCreated,
      emailsFailed: result.emailsFailed
    }
  };
}

const webhook_post = defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections();
    await ensureInboxIndexes();
    const body = await readBody(event).catch(() => null);
    const result = await handleInboxPubSubPush(body);
    if (!result.success) {
      throw createError({
        statusCode: result.statusCode,
        statusMessage: result.error
      });
    }
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      const sc = error.statusCode;
      if (sc === 400) throw error;
    }
    setResponseStatus(event, 200);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process webhook"
    };
  }
});

export { webhook_post as default };
//# sourceMappingURL=webhook.post.mjs.map
