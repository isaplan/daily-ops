/**
 * @registry-id: gmailApiService
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-27T12:00:00.000Z
 * @description: Gmail API service - OAuth2 authentication and email fetching
 * @last-fix: [2026-01-27] No changes - watch functionality moved to gmailWatchService
 * 
 * @imports-from:
 *   - googleapis => Gmail API client library
 * 
 * @exports-to:
 *   ✓ app/lib/services/emailProcessorService.ts => Uses gmailApiService to fetch emails
 *   ✓ app/api/inbox/sync/route.ts => Triggers email sync via Gmail API
 */

// Prevent client-side usage
if (typeof window !== 'undefined') {
  throw new Error('Gmail API service cannot be used in client-side code')
}

import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  historyId: string
  internalDate: string
  payload?: gmail_v1.Schema$MessagePart
  sizeEstimate: number
}

export interface GmailAttachment {
  attachmentId: string
  size: number
  data?: string
}

export interface FetchEmailsOptions {
  maxResults?: number
  query?: string
  pageToken?: string
}

export interface FetchEmailsResult {
  messages: GmailMessage[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

class GmailApiService {
  private gmail: gmail_v1.Gmail | null = null
  private auth: any = null

  /**
   * Initialize Gmail API client with OAuth2 credentials
   */
  async initialize(): Promise<void> {
    try {
      const clientId = process.env.GMAIL_CLIENT_ID
      const clientSecret = process.env.GMAIL_CLIENT_SECRET
      const refreshToken = process.env.GMAIL_REFRESH_TOKEN
      const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:8080'

      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
          'Gmail OAuth2 credentials missing. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in .env'
        )
      }

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      oauth2Client.setCredentials({ refresh_token: refreshToken })

      this.auth = oauth2Client
      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    } catch (error) {
      throw new Error(
        `Failed to initialize Gmail API: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Ensure Gmail client is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.gmail || !this.auth) {
      await this.initialize()
    }
  }

  /**
   * Fetch emails from Gmail inbox
   */
  async fetchEmails(options: FetchEmailsOptions = {}): Promise<FetchEmailsResult> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    try {
      const inboxAddress = process.env.GMAIL_INBOX_ADDRESS || 'inboxhaagsenieuwehorecagroep@gmail.com'
      const query = options.query || `to:${inboxAddress}`

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults: options.maxResults || 50,
        q: query,
        pageToken: options.pageToken,
      })

      const messageIds = response.data.messages?.map((msg) => msg.id || '').filter(Boolean) || []

      if (messageIds.length === 0) {
        return {
          messages: [],
          nextPageToken: response.data.nextPageToken || undefined,
          resultSizeEstimate: response.data.resultSizeEstimate || 0,
        }
      }

      // Fetch full message details
      const messagePromises = messageIds.map((id) => this.getMessage(id))
      const messages = await Promise.all(messagePromises)

      return {
        messages: messages.filter((msg): msg is GmailMessage => msg !== null),
        nextPageToken: response.data.nextPageToken || undefined,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch emails: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get full message details by ID
   */
  async getMessage(messageId: string): Promise<GmailMessage | null> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      })

      const message = response.data

      if (!message.id) {
        return null
      }

      return {
        id: message.id,
        threadId: message.threadId || '',
        labelIds: message.labelIds || [],
        snippet: message.snippet || '',
        historyId: message.historyId || '',
        payload: message.payload,
        sizeEstimate: message.sizeEstimate || 0,
        internalDate: message.internalDate || '',
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Download attachment from message
   */
  async downloadAttachment(messageId: string, attachmentId: string): Promise<GmailAttachment> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    try {
      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      })

      return {
        attachmentId,
        size: parseInt(response.data.size || '0', 10),
        data: response.data.data || undefined,
      }
    } catch (error) {
      throw new Error(
        `Failed to download attachment: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get OAuth2 authorization URL (for initial setup)
   */
  getAuthorizationUrl(): string {
    const clientId = process.env.GMAIL_CLIENT_ID
    const clientSecret = process.env.GMAIL_CLIENT_SECRET
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:8080'

    if (!clientId || !clientSecret) {
      throw new Error('Gmail OAuth2 credentials missing')
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    const scopes = ['https://www.googleapis.com/auth/gmail.readonly']

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    })
  }
}

export const gmailApiService = new GmailApiService()
