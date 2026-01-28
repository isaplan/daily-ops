/**
 * @registry-id: EmailAttachmentPreviewComponent
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Email attachment preview component - shows attachment info and parse status
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/card.tsx => Card components
 *   - app/components/ui/badge.tsx => Badge component
 *   - app/components/ProcessingStatusBadge.tsx => Status badge
 *   - app/lib/types/inbox.types.ts => EmailAttachment type
 * 
 * @exports-to:
 *   ✓ app/components/InboxEmailDetail.tsx => Shows attachment list
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProcessingStatusBadge } from './ProcessingStatusBadge'
import type { EmailAttachment } from '@/lib/types/inbox.types'
import { FileText, Download, RefreshCw } from 'lucide-react'

interface EmailAttachmentPreviewProps {
  attachment: EmailAttachment
  onReparse?: (attachmentId: string) => void
  onDownload?: (attachmentId: string) => void
}

export function EmailAttachmentPreview({
  attachment,
  onReparse,
  onDownload,
}: EmailAttachmentPreviewProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getDocumentTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      hours: 'Eitje Hours',
      contracts: 'Eitje Contracts',
      finance: 'Eitje Finance',
      sales: 'Bork Sales',
      payroll: 'Payroll',
      bi: 'Power-BI',
      formitabele: 'Formitabele',
      pasy: 'Pasy',
      other: 'Other',
      coming_soon: 'Coming Soon',
    }
    return labels[type] || type
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <CardTitle className="text-base">{attachment.fileName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{attachment.metadata.format.toUpperCase()}</Badge>
                <Badge variant="outline">{getDocumentTypeLabel(attachment.documentType)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.fileSize)}
                </span>
              </div>
            </div>
          </div>
          <ProcessingStatusBadge status={attachment.parseStatus} />
        </div>
      </CardHeader>
      <CardContent>
        {attachment.metadata.rowCount !== undefined && (
          <div className="text-sm text-muted-foreground mb-3">
            <span className="font-medium">Rows:</span> {attachment.metadata.rowCount}
            {attachment.metadata.columnCount && (
              <>
                {' • '}
                <span className="font-medium">Columns:</span> {attachment.metadata.columnCount}
              </>
            )}
            {attachment.metadata.sheets && attachment.metadata.sheets.length > 1 && (
              <>
                {' • '}
                <span className="font-medium">Sheets:</span> {attachment.metadata.sheets.join(', ')}
              </>
            )}
          </div>
        )}
        {attachment.parseError && (
          <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
            <p className="text-sm text-red-800">{attachment.parseError}</p>
          </div>
        )}
        <div className="flex gap-2">
          {onReparse && attachment.parseStatus === 'failed' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReparse(attachment._id)}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Re-parse
            </Button>
          )}
          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(attachment._id)}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
