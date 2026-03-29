/**
 * @registry-id: gmailWatchService
 * @created: 2026-01-27T12:00:00.000Z
 * @last-modified: 2026-01-27T12:00:00.000Z
 * @description: Gmail Watch service - manages Gmail push notification subscriptions via Pub/Sub
 * @last-fix: [2026-01-27] Initial implementation - Gmail watch/unwatch with Pub/Sub
 * 
 * @imports-from:
 *   - app/lib/services/gmailApiService.ts => Gmail API client
 *   - googleapis => Gmail API watch methods
 * 
 * @exports-to:
 *   ✓ app/api/inbox/watch/route.ts => Uses gmailWatchService for watch management
 *   ✓ app/api/inbox/webhook/route.ts => Uses gmailWatchService to process notifications
 */

// Prevent client-side usage
if (typeof window !== 'undefined') {
  throw new Error('Gmail Watch service cannot be used in client-side code')
}

import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import { gmailApiService } from './gmailApiService'

export interface WatchRequest {
  topicName: string
  labelIds?: string[]
}

export interface WatchResponse {
  historyId: string
  expiration: string
}

export interface HistoryRecord {
  id: string
  messages?: Array<{ id: string; threadId: string }>
  messagesAdded?: Array<{ message: { id: string; threadId: string } }>
  messagesDeleted?: Array<{ message: { id: string } }>
  labelsAdded?: Array<{ message: { id: string; labelIds: string[] } }>
  labelsRemoved?: Array<{ message: { id: string; labelIds: string[] } }>
}

class GmailWatchService {
  private gmail: gmail_v1.Gmail | null = null
  private auth: any = null

  /**
   * Initialize Gmail API client with OAuth2 credentials
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.gmail || !this.auth) {
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
    }
  }

  /**
   * Start watching for Gmail inbox changes
   * Subscribes to push notifications via Pub/Sub
   */
  async watch(request: WatchRequest): Promise<WatchResponse> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    try {
      const inboxAddress = process.env.GMAIL_INBOX_ADDRESS || 'inboxhaagsenieuwehorecagroep@gmail.com'
      const query = `to:${inboxAddress}`

      const response = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: request.topicName,
          labelIds: request.labelIds || ['INBOX'],
          labelFilterAction: 'include',
        },
      })

      if (!response.data.historyId || !response.data.expiration) {
        throw new Error('Invalid watch response from Gmail API')
      }

      return {
        historyId: response.data.historyId,
        expiration: response.data.expiration,
      }
    } catch (error) {
      throw new Error(
        `Failed to start Gmail watch: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Stop watching for Gmail inbox changes
   */
  async stop(): Promise<void> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    try {
      await this.gmail.users.stop({
        userId: 'me',
      })
    } catch (error) {
      throw new Error(
        `Failed to stop Gmail watch: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get history of changes since a specific historyId
   */
  async getHistory(historyId: string, maxResults?: number): Promise<HistoryRecord[]> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    try {
      const response = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        maxResults: maxResults || 100,
      })

      const historyRecords: HistoryRecord[] = []

      if (response.data.history) {
        for (const record of response.data.history) {
          historyRecords.push({
            id: record.id || '',
            messages: record.messages?.map((m) => ({
              id: m.id || '',
              threadId: m.threadId || '',
            })),
            messagesAdded: record.messagesAdded?.map((ma) => ({
              message: {
                id: ma.message?.id || '',
                threadId: ma.message?.threadId || '',
              },
            })),
            messagesDeleted: record.messagesDeleted?.map((md) => ({
              message: {
                id: md.message?.id || '',
              },
            })),
            labelsAdded: record.labelsAdded?.map((la) => ({
              message: {
                id: la.message?.id || '',
                labelIds: la.labelIds || [],
              },
            })),
            labelsRemoved: record.labelsRemoved?.map((lr) => ({
              message: {
                id: lr.message?.id || '',
                labelIds: lr.labelIds || [],
              },
            })),
          })
        }
      }

      return historyRecords
    } catch (error) {
      throw new Error(
        `Failed to get Gmail history: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}

export const gmailWatchService = new GmailWatchService()
