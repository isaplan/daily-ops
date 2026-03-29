/**
 * @registry-id: InboxEmailDetailPage
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox email detail page - shows single email with attachments and parsed data
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useInboxViewModel.ts => Inbox ViewModel
 *   - app/components/InboxEmailDetail.tsx => Email detail component
 *   - app/components/ui/skeleton.tsx => Loading skeleton
 * 
 * @exports-to:
 *   ✓ app/components/InboxEmailList.tsx => Navigation link
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useInboxViewModel } from '@/lib/viewmodels/useInboxViewModel'
import { InboxEmailDetail } from '@/components/InboxEmailDetail'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import type { InboxEmail, EmailAttachment } from '@/lib/types/inbox.types'

export default function InboxEmailDetailPage() {
  const params = useParams()
  const emailId = params.emailId as string
  const viewModel = useInboxViewModel()
  const [email, setEmail] = useState<(InboxEmail & { attachments?: EmailAttachment[] }) | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (emailId) {
      loadEmail()
    }
  }, [emailId])

  const loadEmail = async () => {
    setLoading(true)
    const emailData = await viewModel.getEmail(emailId)
    setEmail(emailData)
    setLoading(false)
  }

  const handleReparse = async (attachmentId: string) => {
    // Trigger re-parse via API
    await fetch(`/api/inbox/process/${emailId}`, { method: 'POST' })
    await loadEmail()
  }

  const handleProcess = async (emailId: string) => {
    await viewModel.processEmail(emailId)
    await loadEmail()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Email not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <InboxEmailDetail
        email={email}
        onReparse={handleReparse}
        onProcess={handleProcess}
      />
    </div>
  )
}
