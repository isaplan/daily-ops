/**
 * @registry-id: ProcessingStatusBadgeComponent
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Processing status badge component - shows email/attachment processing status
 * @last-fix: [2026-01-28] Fixed spinning animation to only apply to icon, not entire badge
 * 
 * @imports-from:
 *   - app/components/ui/badge.tsx => Badge component
 *   - app/lib/types/inbox.types.ts => EmailStatus, ParseStatus types
 * 
 * @exports-to:
 *   ✓ app/components/InboxEmailList.tsx => Shows email status
 *   ✓ app/components/EmailAttachmentPreview.tsx => Shows attachment parse status
 */

'use client'

import { Badge } from '@/components/ui/badge'
import type { EmailStatus, ParseStatus } from '@/lib/types/inbox.types'
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react'

interface ProcessingStatusBadgeProps {
  status: EmailStatus | ParseStatus
  size?: 'sm' | 'md' | 'lg'
}

export function ProcessingStatusBadge({ status, size = 'md' }: ProcessingStatusBadgeProps) {
  const statusConfig = {
    received: {
      label: 'Received',
      variant: 'secondary' as const,
      icon: Clock,
      className: 'bg-blue-100 text-blue-800',
    },
    processing: {
      label: 'Processing',
      variant: 'secondary' as const,
      icon: Loader2,
      className: 'bg-yellow-100 text-yellow-800',
    },
    pending: {
      label: 'Pending',
      variant: 'secondary' as const,
      icon: Clock,
      className: 'bg-gray-100 text-gray-800',
    },
    parsing: {
      label: 'Parsing',
      variant: 'secondary' as const,
      icon: Loader2,
      className: 'bg-yellow-100 text-yellow-800',
    },
    completed: {
      label: 'Completed',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800',
    },
    success: {
      label: 'Success',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800',
    },
    failed: {
      label: 'Failed',
      variant: 'destructive' as const,
      icon: XCircle,
      className: 'bg-red-100 text-red-800',
    },
  }

  const config = statusConfig[status] || statusConfig.received
  const Icon = config.icon

  const shouldSpin = status === 'processing' || status === 'parsing'

  return (
    <Badge variant={config.variant} className={`${config.className} flex items-center gap-1`}>
      <Icon className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} ${shouldSpin ? 'animate-spin' : ''}`} />
      <span className={size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs'}>
        {config.label}
      </span>
    </Badge>
  )
}
