/**
 * @registry-id: chatsPage
 * @created: 2026-01-16T16:00:00.000Z
 * @last-modified: 2026-01-16T16:00:00.000Z
 * @description: Chats dashboard page (Server Component) - Design V2
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Chats interface
 * 
 * @imports-from:
 *   - app/components/chats/ChatsDashboard.tsx => Client dashboard component
 * 
 * @exports-to:
 *   ✓ app/layout.tsx => Route accessible via /chats
 */

import { Suspense } from 'react'
import ChatsDashboard from '@/components/chats/ChatsDashboard'
import { Skeleton } from '@/components/ui/skeleton'

function ChatsContent() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full">
          <Skeleton className="w-64" />
          <Skeleton className="flex-1" />
        </div>
      }
    >
      <ChatsDashboard />
    </Suspense>
  )
}

export default function ChatsPage() {
  return <ChatsContent />
}
