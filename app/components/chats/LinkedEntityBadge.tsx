/**
 * @registry-id: LinkedEntityBadge
 * @created: 2026-01-16T16:00:00.000Z
 * @last-modified: 2026-01-16T16:00:00.000Z
 * @description: Linked entity badge component using shadcn Badge only
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Chats interface
 * 
 * @imports-from:
 *   - app/components/ui/badge.tsx => Badge microcomponent
 *   - app/lib/types/connections.ts => LinkedEntityDisplay type
 * 
 * @exports-to:
 *   ✓ app/components/chats/** => Components use LinkedEntityBadge
 */

'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { LinkedEntityDisplay } from '@/lib/types/connections'

interface LinkedEntityBadgeProps {
  entity: LinkedEntityDisplay
}

export default function LinkedEntityBadge({ entity }: LinkedEntityBadgeProps) {
  const href =
    entity.type === 'note'
      ? `/notes/${entity.slug || entity.id}`
      : entity.type === 'todo'
      ? `/todos`
      : entity.type === 'channel'
      ? `/channels/${entity.id}`
      : '#'

  return (
    <Badge variant="outline" className="cursor-pointer hover:bg-white/10" asChild>
      <Link href={href}>
        {entity.title || entity.name || entity.type}
      </Link>
    </Badge>
  )
}
