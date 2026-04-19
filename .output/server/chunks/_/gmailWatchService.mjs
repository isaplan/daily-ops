import { google } from 'googleapis';

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class GmailWatchService {
  constructor() {
    __publicField(this, "gmail", null);
    __publicField(this, "auth", null);
  }
  async ensureInitialized() {
    if (!this.gmail || !this.auth) {
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
      const redirectUri = process.env.GMAIL_REDIRECT_URI || "http://localhost:8080";
      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
          "Gmail OAuth2 credentials missing. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in .env"
        );
      }
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      this.auth = oauth2Client;
      this.gmail = google.gmail({ version: "v1", auth: oauth2Client });
    }
  }
  async watch(request) {
    await this.ensureInitialized();
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }
    const response = await this.gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: request.topicName,
        labelIds: request.labelIds || ["INBOX"],
        labelFilterAction: "include"
      }
    });
    if (!response.data.historyId || !response.data.expiration) {
      throw new Error("Invalid watch response from Gmail API");
    }
    return {
      historyId: response.data.historyId,
      expiration: response.data.expiration
    };
  }
  async stop() {
    await this.ensureInitialized();
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }
    await this.gmail.users.stop({
      userId: "me"
    });
  }
  mapHistoryRecord(record) {
    var _a, _b, _c, _d, _e;
    return {
      id: record.id || "",
      messages: (_a = record.messages) == null ? void 0 : _a.map((m) => ({
        id: m.id || "",
        threadId: m.threadId || ""
      })),
      messagesAdded: (_b = record.messagesAdded) == null ? void 0 : _b.map((ma) => {
        var _a2, _b2;
        return {
          message: {
            id: ((_a2 = ma.message) == null ? void 0 : _a2.id) || "",
            threadId: ((_b2 = ma.message) == null ? void 0 : _b2.threadId) || ""
          }
        };
      }),
      messagesDeleted: (_c = record.messagesDeleted) == null ? void 0 : _c.map((md) => {
        var _a2;
        return {
          message: {
            id: ((_a2 = md.message) == null ? void 0 : _a2.id) || ""
          }
        };
      }),
      labelsAdded: (_d = record.labelsAdded) == null ? void 0 : _d.map((la) => {
        var _a2;
        return {
          message: {
            id: ((_a2 = la.message) == null ? void 0 : _a2.id) || "",
            labelIds: la.labelIds || []
          }
        };
      }),
      labelsRemoved: (_e = record.labelsRemoved) == null ? void 0 : _e.map((lr) => {
        var _a2;
        return {
          message: {
            id: ((_a2 = lr.message) == null ? void 0 : _a2.id) || "",
            labelIds: lr.labelIds || []
          }
        };
      })
    };
  }
  /** Single page (legacy callers). Prefer getHistoryAll for webhook traffic. */
  async getHistory(historyId, maxResults) {
    var _a;
    await this.ensureInitialized();
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }
    const response = await this.gmail.users.history.list({
      userId: "me",
      startHistoryId: historyId,
      maxResults: maxResults || 100
    });
    return ((_a = response.data.history) != null ? _a : []).map((r) => this.mapHistoryRecord(r));
  }
  /** Follows nextPageToken until exhausted so large bursts are not truncated at 100 records. */
  async getHistoryAll(startHistoryId, maxResultsPerPage = 100) {
    var _a;
    await this.ensureInitialized();
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }
    const historyRecords = [];
    let pageToken;
    while (true) {
      const response = await this.gmail.users.history.list({
        userId: "me",
        maxResults: maxResultsPerPage,
        ...pageToken ? { pageToken } : { startHistoryId }
      });
      if ((_a = response.data.history) == null ? void 0 : _a.length) {
        for (const record of response.data.history) {
          historyRecords.push(this.mapHistoryRecord(record));
        }
      }
      if (!response.data.nextPageToken) break;
      pageToken = response.data.nextPageToken;
    }
    return historyRecords;
  }
}
const gmailWatchService = new GmailWatchService();

export { gmailWatchService as g };
//# sourceMappingURL=gmailWatchService.mjs.map
