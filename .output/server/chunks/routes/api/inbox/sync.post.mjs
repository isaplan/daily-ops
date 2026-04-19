import { d as defineEventHandler, A as ensureInboxCollections, B as ensureInboxIndexes, r as readBody, c as createError } from '../../../nitro/nitro.mjs';
import { g as gmailApiService } from '../../../_/gmailApiService.mjs';
import { e as findEmailByMessageId, h as insertEmail, j as insertAttachment, c as insertProcessingLog } from '../../../_/inboxRepository.mjs';
import 'mongodb';
import 'papaparse';
import 'fs';
import 'path';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '@iconify/utils';
import 'consola';
import 'googleapis';

class EmailProcessorService {
  extractEmailFromHeaders(headers) {
    const fromHeader = headers.find((h) => {
      var _a;
      return ((_a = h.name) == null ? void 0 : _a.toLowerCase()) === "from";
    });
    if (!(fromHeader == null ? void 0 : fromHeader.value)) {
      return "unknown@unknown.com";
    }
    const emailMatch = fromHeader.value.match(/<([^>]+)>/) || fromHeader.value.match(/(\S+@\S+)/);
    return emailMatch ? emailMatch[1] : fromHeader.value;
  }
  extractSubject(headers) {
    const subjectHeader = headers.find((h) => {
      var _a;
      return ((_a = h.name) == null ? void 0 : _a.toLowerCase()) === "subject";
    });
    return (subjectHeader == null ? void 0 : subjectHeader.value) || "(No Subject)";
  }
  extractDate(message) {
    if (message.internalDate) {
      return new Date(parseInt(message.internalDate, 10));
    }
    return /* @__PURE__ */ new Date();
  }
  extractAttachments(message) {
    const attachments = [];
    const processPart = (part) => {
      var _a;
      if (part.filename && ((_a = part.body) == null ? void 0 : _a.attachmentId)) {
        attachments.push({
          partId: part.partId || "",
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: parseInt(part.body.size || "0", 10),
          attachmentId: part.body.attachmentId
        });
      }
      if (part.parts) {
        part.parts.forEach((p) => processPart(p));
      }
    };
    if (message.payload) {
      processPart(message.payload);
    }
    return attachments;
  }
  async processEmails(options = {}) {
    const result = await gmailApiService.fetchEmails({
      maxResults: options.maxResults || 50,
      query: options.query
    });
    const processedEmails = [];
    for (const message of result.messages) {
      try {
        const payload = message.payload;
        if (!(payload == null ? void 0 : payload.headers)) {
          continue;
        }
        const from = this.extractEmailFromHeaders(payload.headers);
        const subject = this.extractSubject(payload.headers);
        const receivedAt = this.extractDate(message);
        const summary = message.snippet || "";
        const attachments = this.extractAttachments(message);
        const email = {
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
        };
        const attachmentDtos = attachments.map((att) => ({
          emailId: "",
          fileName: att.filename,
          mimeType: att.mimeType,
          fileSize: att.size,
          googleAttachmentId: att.attachmentId,
          metadata: {
            format: this.detectFormat(att.mimeType)
          }
        }));
        processedEmails.push({
          email,
          attachments: attachmentDtos
        });
      } catch {
        continue;
      }
    }
    return processedEmails;
  }
  detectFormat(mimeType) {
    if (mimeType.includes("csv") || mimeType === "text/csv") {
      return "csv";
    }
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel") {
      return "xlsx";
    }
    if (mimeType.includes("pdf") || mimeType === "application/pdf") {
      return "pdf";
    }
    return "unknown";
  }
  async downloadAttachment(messageId, attachmentId) {
    return gmailApiService.downloadAttachment(messageId, attachmentId);
  }
}
const emailProcessorService = new EmailProcessorService();

const sync_post = defineEventHandler(async (event) => {
  var _a;
  try {
    await ensureInboxCollections();
    await ensureInboxIndexes();
    const body = await readBody(event).catch(() => ({}));
    const maxResults = (_a = body.maxResults) != null ? _a : 50;
    const query = body.query;
    const processedEmails = await emailProcessorService.processEmails({
      maxResults,
      query
    });
    let emailsCreated = 0;
    let emailsFailed = 0;
    for (const processed of processedEmails) {
      try {
        const existing = await findEmailByMessageId(processed.email.messageId);
        if (existing) {
          continue;
        }
        const { _id: emailId } = await insertEmail(processed.email);
        for (const attachmentDto of processed.attachments) {
          await insertAttachment(emailId, {
            ...attachmentDto,
            emailId: String(emailId)
          });
        }
        await insertProcessingLog({
          emailId: String(emailId),
          eventType: "fetch",
          status: "success",
          message: `Email fetched and stored: ${processed.email.subject}`
        });
        emailsCreated++;
      } catch {
        emailsFailed++;
        await insertProcessingLog({
          eventType: "fetch",
          status: "error",
          message: "Failed to store email",
          details: { email: processed.email }
        });
      }
    }
    return {
      success: true,
      data: {
        emailsCreated,
        emailsFailed,
        total: processedEmails.length
      }
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to sync emails"
    });
  }
});

export { sync_post as default };
//# sourceMappingURL=sync.post.mjs.map
