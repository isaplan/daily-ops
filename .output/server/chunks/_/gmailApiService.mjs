import { google } from 'googleapis';

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
  async ensureInitialized() {
    if (!this.gmail || !this.auth) {
      await this.initialize();
    }
  }
  async fetchEmails(options = {}) {
    var _a;
    await this.ensureInitialized();
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }
    const inboxAddress = process.env.GMAIL_INBOX_ADDRESS || "inboxhaagsenieuwehorecagroep@gmail.com";
    const query = options.query || `to:${inboxAddress}`;
    const response = await this.gmail.users.messages.list({
      userId: "me",
      maxResults: options.maxResults || 50,
      q: query,
      pageToken: options.pageToken
    });
    const messageIds = ((_a = response.data.messages) == null ? void 0 : _a.map((msg) => msg.id || "").filter(Boolean)) || [];
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
      attachmentId,
      size: parseInt(response.data.size || "0", 10),
      data: response.data.data || void 0
    };
  }
  getAuthorizationUrl() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || "http://localhost:8080";
    if (!clientId || !clientSecret) {
      throw new Error("Gmail OAuth2 credentials missing");
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent"
    });
  }
}
const gmailApiService = new GmailApiService();

export { gmailApiService as g };
//# sourceMappingURL=gmailApiService.mjs.map
