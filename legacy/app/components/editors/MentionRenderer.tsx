/**
 * @registry-id: MentionRenderer
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-18T00:00:00.000Z
 * @description: Render component for @mention inline content in BlockNote
 * @last-fix: [2026-01-18] Initial implementation
 * 
 * @imports-from:
 *   - app/components/ui/badge.tsx => Badge microcomponent
 * 
 * @exports-to:
 *   ✓ app/lib/services/mentionInlineSpec.ts => Used in inline content spec
 */

'use client'

import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface MentionRendererProps {
  userId: string
  userName: string
}

export function MentionRenderer({ userId, userName }: MentionRendererProps) {
  return (
    <Link href={`/members/${userId}`} className="inline-flex items-center">
      <Badge variant="secondary" className="mx-1">
        @{userName}
      </Badge>
    </Link>
  )
}
