/**
 * @registry-id: editModeComponent
 * @created: 2026-01-16T22:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: EditMode microcomponent - toggle between view/edit modes with visual indicators
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/button.tsx => Button component
 *   - app/components/ui/card.tsx => Card component
 * 
 * @exports-to:
 *   ✓ app/components/NoteDetailPage.tsx => Edit mode for notes
 *   ✓ app/components/** => All detail pages use EditMode
 */

'use client'

import { ReactNode } from 'react'
import { Button } from './button'
import { Card, CardContent } from './card'
import { cn } from '@/lib/utils/cn'
import { Edit2, Save, X } from 'lucide-react'

interface EditModeProps {
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  loading?: boolean
  disabled?: boolean
  children: ReactNode
  className?: string
}

export function EditMode({
  isEditing,
  onEdit,
  onSave,
  onCancel,
  loading = false,
  disabled = false,
  children,
  className,
}: EditModeProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-end gap-2">
        {!isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={disabled}
          >
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onSave}
              disabled={loading || disabled}
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={loading}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      <Card
        className={cn(
          'transition-all',
          isEditing
            ? 'border-primary ring-2 ring-primary/20 bg-accent/50'
            : 'border-border'
        )}
      >
        <CardContent className={cn('pt-6', isEditing && 'bg-accent/30')}>
          {children}
        </CardContent>
      </Card>
    </div>
  )
}
