/**
 * @registry-id: InboxEmailsListPage
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox emails list page - full list of emails with filters and pagination
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/components/InboxEmailList.tsx => Email list component
 * 
 * @exports-to:
 *   ✓ app/components/DailyOpsSidebar.tsx => Navigation link
 */

'use client'

import { InboxEmailList } from '@/components/InboxEmailList'

export default function InboxEmailsListPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">All Emails</h1>
        <p className="text-muted-foreground">View and manage all emails in inbox</p>
      </div>
      <InboxEmailList />
    </div>
  )
}
