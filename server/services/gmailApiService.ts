/**
 * @registry-id: gmailApiServiceV2
 * @created: 2026-05-02T15:00:00.000Z
 * @last-modified: 2026-05-03T20:10:00.000Z
 * @description: Clean rebuild of Gmail API service — explicit token + redirect_uri handling
 * @last-fix: [2026-05-03] Rebuild from scratch with strict redirect_uri matching
 *
 * @exports-to:
 * ✓ server/services/emailProcessorService.ts
 * ✓ server/services/inboxProcessService.ts
 */

import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import { getGmailRefreshToken } from './gmailOAuthService'
import { getGmailRedirectUri } from '../utils/gmailRedirectUri'

export type GmailMessage = {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  historyId: string
  internalDate: string
  payload?: gmail_v1.Schema$MessagePart
  sizeEstimate: number
}

export type GmailAttachment = {
  attachmentId: string
  size: number
  data?: string
}

export type FetchEmailsOptions = {
  maxResults?: number
  query?: string
  pageToken?: string
}

export type FetchEmailsResult = {
  messages: GmailMessage[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

class GmailApiService {
  private gmail: gmail_v1.Gmail | null = null
  private auth: ReturnType<typeof google.auth.OAuth2> | null = null

  async initialize(): Promise<void> {
    const clientId = process.env.GMAIL_CLIENT_ID
    const clientSecret = process.env.GMAIL_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error(
        'GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET missing',
      )
    }

    let refreshToken = process.env.GMAIL_REFRESH_TOKEN

    if (!refreshToken) {
      refreshToken = await getGmailRefreshToken()
    }

    if (!refreshToken) {
      throw new Error(
        'No refresh token found. Connect Gmail using the UI first.',
      )
    }

    const redirectUri = getGmailRedirectUri()

    console.log('[gmailApiService] Initializing with:')
    console.log('  - clientId:', clientId.slice(0, 20) + '...')
    console.log('  - redirectUri:', redirectUri)
    console.log('  - refreshToken:', refreshToken.slice(0, 20) + '...')

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    this.auth = oauth2Client
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.gmail || !this.auth) {
      await this.initialize()
    }
  }

  async fetchEmails(options: FetchEmailsOptions = {}): Promise<FetchEmailsResult> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    const inboxAddress = process.env.GMAIL_INBOX_ADDRESS || 'inboxhaagsenieuwehorecagroep@gmail.com'
    const query = options.query || `to:${inboxAddress}`

    try {
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

      const messagePromises = messageIds.map((id) => this.getMessage(id))
      const messages = await Promise.all(messagePromises)

      return {
        messages: messages.filter((msg): msg is GmailMessage => msg !== null),
        nextPageToken: response.data.nextPageToken || undefined,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      }
    } catch (err) {
      console.error('[gmailApiService] fetchEmails error:', err)
      throw err
    }
  }

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
    } catch {
      return null
    }
  }

  async downloadAttachment(messageId: string, attachmentId: string): Promise<GmailAttachment> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    const response = await this.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    })

    return {
      attachmentId: response.data.id || attachmentId,
      size: parseInt(response.data.size || '0', 10),
      data: response.data.data || undefined,
    }
  }
}

export const gmailApiService = new GmailApiService()
