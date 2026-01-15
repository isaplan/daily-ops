/**
 * @registry-id: cardHeaderComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: CardHeader composite microcomponent - Card header with title + actions
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/card.tsx => Card components
 *   - app/components/ui/button.tsx => Button component
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use CardHeader for card headers with actions
 */

import * as React from 'react'
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export interface CardHeaderWithActionsProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function CardHeaderWithActions({
  title,
  description,
  actions,
  className,
  ...props
}: CardHeaderWithActionsProps) {
  return (
    <CardHeader className={cn('flex flex-row items-center justify-between', className)} {...props}>
      <div>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </CardHeader>
  )
}
