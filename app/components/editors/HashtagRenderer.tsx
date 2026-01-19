/**
 * @registry-id: HashtagRenderer
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-18T00:00:00.000Z
 * @description: Render component for #hashtag inline content in BlockNote
 * @last-fix: [2026-01-18] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/badge.tsx => Badge microcomponent
 * 
 * @exports-to:
 *   ✓ app/lib/services/hashtagInlineSpec.ts => Used in inline content spec
 */

'use client'

import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface HashtagRendererProps {
  entityType: string
  entityId: string
  entityName: string
}

function getEntityUrl(entityType: string, entityId: string): string {
  switch (entityType) {
    case 'channel':
      return `/channels/${entityId}`
    case 'note':
      return `/notes/${entityId}`
    case 'todo':
      return `/todos`
    case 'event':
      return `/events/${entityId}`
    case 'decision':
      return `/decisions/${entityId}`
    default:
      return '#'
  }
}

export function HashtagRenderer({
  entityType,
  entityId,
  entityName,
}: HashtagRendererProps) {
  const url = getEntityUrl(entityType, entityId)

  return (
    <Link href={url} className="inline-flex items-center">
      <Badge variant="outline" className="mx-1">
        #{entityName}
      </Badge>
    </Link>
  )
}
