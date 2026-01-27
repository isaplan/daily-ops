/**
 * @registry-id: emptyStateComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-27T12:00:00.000Z
 * @description: EmptyState microcomponent - Empty state placeholder
 * @last-fix: [2026-01-27] Fixed icon rendering - properly handles React components, forwardRef, and ReactNodes
 * 
 * @imports-from:
 *   - app/components/ui/button.tsx => Button component
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use EmptyState for empty lists
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  ...props
}: EmptyStateProps) {
  const renderIcon = () => {
    if (!icon) return null
    // Check if icon is already a valid React element
    if (React.isValidElement(icon)) {
      return icon
    }
    // Check if icon is a React component (function or forwardRef)
    if (typeof icon === 'function' || (icon && typeof icon === 'object' && 'render' in icon)) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>
      return React.createElement(IconComponent, { className: 'h-12 w-12 text-muted-foreground' })
    }
    return icon
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
      {...props}
    >
      {icon && <div className="mb-4 text-muted-foreground">{renderIcon()}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  )
}
