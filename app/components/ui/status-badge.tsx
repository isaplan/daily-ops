/**
 * @registry-id: statusBadgeComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: StatusBadge composite microcomponent - Status badge with semantic variants
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/badge.tsx => Badge component
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use StatusBadge for status indicators
 */

import * as React from 'react'
import { Badge, badgeVariants } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

export type StatusVariant = 'success' | 'error' | 'warning' | 'info' | 'default'

const statusVariantMap: Record<StatusVariant, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  default: 'bg-gray-100 text-gray-800 border-gray-200',
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusVariant
  children: React.ReactNode
}

export function StatusBadge({ status, children, className, ...props }: StatusBadgeProps) {
  return (
    <Badge
      className={cn(statusVariantMap[status], className)}
      {...props}
    >
      {children}
    </Badge>
  )
}
