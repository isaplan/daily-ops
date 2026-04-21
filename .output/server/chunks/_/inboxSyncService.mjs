import { A as ensureInboxCollections, B as ensureInboxIndexes } from '../nitro/nitro.mjs';
import { g as gmailApiService, a as processEmailAttachments } from './inboxProcessService.mjs';
import { e as findEmailByMessageId, h as insertEmail, j as insertAttachment, c as insertProcessingLog } from './inboxRepository.mjs';

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

async function runInboxGmailSync(options) {
  var _a;
  await ensureInboxCollections();
  await ensureInboxIndexes();
  const maxResults = (_a = options.maxResults) != null ? _a : 50;
  const query = options.query;
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
      try {
        const proc = await processEmailAttachments(String(emailId));
        await insertProcessingLog({
          emailId: String(emailId),
          eventType: "parse",
          status: proc.success ? "success" : "warning",
          message: `Auto-process after sync: ${proc.attachmentsProcessed} attachment(s) ok, ${proc.attachmentsFailed} failed`
        });
      } catch (procErr) {
        await insertProcessingLog({
          emailId: String(emailId),
          eventType: "parse",
          status: "error",
          message: `Auto-process after sync failed: ${procErr instanceof Error ? procErr.message : "unknown"}`
        });
      }
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
}

export { runInboxGmailSync as r };
//# sourceMappingURL=inboxSyncService.mjs.map
