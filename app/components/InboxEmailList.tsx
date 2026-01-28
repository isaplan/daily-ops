/**
 * @registry-id: InboxEmailListComponent
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Inbox email list component - displays list of emails with filters and pagination
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useInboxViewModel.ts => Inbox ViewModel
 *   - app/components/ui/card.tsx => Card components
 *   - app/components/ui/button.tsx => Button component
 *   - app/components/ui/input.tsx => Input component
 *   - app/components/ui/select.tsx => Select component
 *   - app/components/ProcessingStatusBadge.tsx => Status badge
 * 
 * @exports-to:
 *   ✓ app/daily-ops/inbox/emails/page.tsx => Email list view
 */

'use client'

import { useEffect, useState } from 'react'
import { useInboxViewModel } from '@/lib/viewmodels/useInboxViewModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProcessingStatusBadge } from './ProcessingStatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Mail, Search, Filter } from 'lucide-react'
import Link from 'next/link'
import type { InboxEmail } from '@/lib/types/inbox.types'

export function InboxEmailList() {
  const viewModel = useInboxViewModel()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [archivedFilter, setArchivedFilter] = useState<string>('false')

  useEffect(() => {
    viewModel.loadEmails(1, 20, {
      archived: archivedFilter === 'true',
      ...(statusFilter !== 'all' && { status: statusFilter as InboxEmail['status'] }),
    })
  }, [statusFilter, archivedFilter])

  const filteredEmails = viewModel.state.data.filter((email) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      email.subject.toLowerCase().includes(query) ||
      email.from.toLowerCase().includes(query) ||
      email.messageId.toLowerCase().includes(query)
    )
  })

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (viewModel.state.loading && viewModel.state.data.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (viewModel.state.error && viewModel.state.data.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={Mail}
            title="Failed to load emails"
            description={viewModel.state.error}
          />
        </CardContent>
      </Card>
    )
  }

  if (filteredEmails.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={Mail}
            title="No emails found"
            description={searchQuery ? 'Try adjusting your search filters' : 'No emails in inbox'}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Archived</Label>
              <Select value={archivedFilter} onValueChange={setArchivedFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Active</SelectItem>
                  <SelectItem value="true">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email List */}
      <div className="space-y-3">
        {filteredEmails.map((email) => (
          <Link key={email._id} href={`/daily-ops/inbox/${email._id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base mb-1">{email.subject}</CardTitle>
                    <p className="text-sm text-muted-foreground">{email.from}</p>
                  </div>
                  <ProcessingStatusBadge status={email.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{formatDate(email.receivedAt)}</span>
                  <span>
                    {email.attachmentCount} attachment{email.attachmentCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {email.summary && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{email.summary}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {viewModel.hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => viewModel.loadEmails(viewModel.currentPage + 1, 20)}
            disabled={viewModel.state.loading}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}
