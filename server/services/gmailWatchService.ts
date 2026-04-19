/**
 * @registry-id: gmailWatchService
 * @created: 2026-01-27T12:00:00.000Z
 * @last-modified: 2026-04-19T12:00:00.000Z
 * @description: Gmail watch + history.list (Nuxt Nitro)
 * @last-fix: [2026-04-19] OAuth access tokens refresh on each Gmail call via googleapis refresh_token
 *
 * @exports-to:
 * ✓ server/api/inbox/watch.post.ts
 * ✓ server/services/inboxWebhookService.ts
 */

import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'

export type WatchRequest = {
  topicName: string
  labelIds?: string[]
}

export type WatchResponse = {
  historyId: string
  expiration: string
}

export type HistoryRecord = {
  id: string
  messages?: Array<{ id: string; threadId: string }>
  messagesAdded?: Array<{ message: { id: string; threadId: string } }>
  messagesDeleted?: Array<{ message: { id: string } }>
  labelsAdded?: Array<{ message: { id: string; labelIds: string[] } }>
  labelsRemoved?: Array<{ message: { id: string; labelIds: string[] } }>
}

class GmailWatchService {
  private gmail: gmail_v1.Gmail | null = null
  private auth: ReturnType<typeof google.auth.OAuth2> | null = null

  private async ensureInitialized(): Promise<void> {
    if (!this.gmail || !this.auth) {
      const clientId = process.env.GMAIL_CLIENT_ID
      const clientSecret = process.env.GMAIL_CLIENT_SECRET
      const refreshToken = process.env.GMAIL_REFRESH_TOKEN
      const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:8080'

      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
          'Gmail OAuth2 credentials missing. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in .env',
        )
      }

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      oauth2Client.setCredentials({ refresh_token: refreshToken })

      this.auth = oauth2Client
      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    }
  }

  async watch(request: WatchRequest): Promise<WatchResponse> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

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
  }

  async stop(): Promise<void> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    await this.gmail.users.stop({
      userId: 'me',
    })
  }

  private mapHistoryRecord(record: gmail_v1.Schema$History): HistoryRecord {
    return {
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
    }
  }

  /** Single page (legacy callers). Prefer getHistoryAll for webhook traffic. */
  async getHistory(historyId: string, maxResults?: number): Promise<HistoryRecord[]> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    const response = await this.gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      maxResults: maxResults || 100,
    })

    return (response.data.history ?? []).map((r) => this.mapHistoryRecord(r))
  }

  /** Follows nextPageToken until exhausted so large bursts are not truncated at 100 records. */
  async getHistoryAll(startHistoryId: string, maxResultsPerPage = 100): Promise<HistoryRecord[]> {
    await this.ensureInitialized()

    if (!this.gmail) {
      throw new Error('Gmail client not initialized')
    }

    const historyRecords: HistoryRecord[] = []
    let pageToken: string | undefined

    while (true) {
      // First page: startHistoryId only. Later pages: pageToken only (Gmail API contract).
      const response = await this.gmail.users.history.list({
        userId: 'me',
        maxResults: maxResultsPerPage,
        ...(pageToken ? { pageToken } : { startHistoryId }),
      })

      if (response.data.history?.length) {
        for (const record of response.data.history) {
          historyRecords.push(this.mapHistoryRecord(record))
        }
      }

      if (!response.data.nextPageToken) break
      pageToken = response.data.nextPageToken
    }

    return historyRecords
  }
}

export const gmailWatchService = new GmailWatchService()
