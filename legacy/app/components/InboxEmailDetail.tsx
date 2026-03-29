/**
 * @registry-id: InboxEmailDetailComponent
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox email detail component - shows email details with attachments and parsed data
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/card.tsx => Card components
 *   - app/components/ui/button.tsx => Button component
 *   - app/components/EmailAttachmentPreview.tsx => Attachment preview
 *   - app/components/ParsedDataTable.tsx => Parsed data table
 *   - app/components/ProcessingStatusBadge.tsx => Status badge
 *   - app/lib/types/inbox.types.ts => InboxEmail, EmailAttachment types
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/[emailId]/page.tsx => Email detail view
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmailAttachmentPreview } from './EmailAttachmentPreview'
import { ParsedDataTable } from './ParsedDataTable'
import { ProcessingStatusBadge } from './ProcessingStatusBadge'
import type { InboxEmail, EmailAttachment, ParsedData } from '@/lib/types/inbox.types'
import { ArrowLeft, RefreshCw, Mail } from 'lucide-react'
import Link from 'next/link'

interface InboxEmailDetailProps {
  email: InboxEmail & { attachments?: EmailAttachment[] }
  onReparse?: (attachmentId: string) => void
  onProcess?: (emailId: string) => void
}

export function InboxEmailDetail({ email, onReparse, onProcess }: InboxEmailDetailProps) {
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const attachments = email.attachments || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/daily-ops/inbox/emails">
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Inbox
          </Button>
        </Link>
        {onProcess && email.status !== 'completed' && (
          <Button onClick={() => onProcess(email._id)} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Process Email
          </Button>
        )}
      </div>

      {/* Email Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl mb-2">{email.subject}</CardTitle>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium">From:</span> {email.from}
                </p>
                <p>
                  <span className="font-medium">Received:</span> {formatDate(email.receivedAt)}
                </p>
                <p>
                  <span className="font-medium">Stored:</span> {formatDate(email.storedAt)}
                </p>
              </div>
            </div>
            <ProcessingStatusBadge status={email.status} size="lg" />
          </div>
        </CardHeader>
        <CardContent>
          {email.summary && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-1">Summary:</p>
              <p className="text-sm text-muted-foreground">{email.summary}</p>
            </div>
          )}
          {email.errorMessage && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm font-medium text-red-800 mb-1">Error:</p>
              <p className="text-sm text-red-700">{email.errorMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      {attachments.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Attachments ({attachments.length})</h2>
          {attachments.map((attachment) => (
            <div key={attachment._id}>
              <EmailAttachmentPreview
                attachment={attachment}
                onReparse={onReparse}
              />
              {attachment.parsedDataRef && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-base">Parsed Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ParsedDataTable parsedData={attachment.parsedDataRef as unknown as ParsedData} />
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No attachments</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
