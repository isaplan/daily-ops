/**
 * @registry-id: InboxDashboardPage
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-27T12:00:00.000Z
 * @description: Inbox dashboard page - overview of recent emails and processing status
 * @last-fix: [2026-01-27] Added watch toggle button for Gmail push notifications
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useInboxViewModel.ts => Inbox ViewModel
 *   - app/components/ui/card.tsx => Card components
 *   - app/components/ui/button.tsx => Button component
 *   - app/components/InboxEmailList.tsx => Email list component
 * 
 * @exports-to:
 *   ✓ app/components/DailyOpsSidebar.tsx => Navigation link
 */

'use client'

import { useEffect, useState } from 'react'
import { useInboxViewModel } from '@/lib/viewmodels/useInboxViewModel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InboxEmailList } from '@/components/InboxEmailList'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, RefreshCw, Upload, CheckCircle2, XCircle, Clock, Bell, BellOff, Play } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function InboxDashboardPage() {
  const viewModel = useInboxViewModel()
  const [unprocessedCount, setUnprocessedCount] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [watchLoading, setWatchLoading] = useState(false)
  const [processingAll, setProcessingAll] = useState(false)

  useEffect(() => {
    viewModel.loadEmails(1, 5, { archived: false })
    viewModel.getUnprocessedCount().then(setUnprocessedCount)
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await viewModel.syncEmails({ maxResults: 50 })
      if (result) {
        toast.success(`Synced ${result.emailsCreated || 0} email(s)`)
        await viewModel.getUnprocessedCount().then(setUnprocessedCount)
        await viewModel.loadEmails(1, 5, { archived: false })
      } else {
        toast.error(viewModel.state.error || 'Failed to sync emails')
      }
    } catch (error) {
      toast.error('Failed to sync emails', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleToggleWatch = async () => {
    setWatchLoading(true)
    try {
      if (viewModel.watchStatus.isWatching) {
        const result = await viewModel.stopWatch()
        if (result) {
          toast.success('Watch subscription stopped')
        } else {
          toast.error(viewModel.state.error || 'Failed to stop watch subscription')
        }
      } else {
        const result = await viewModel.startWatch()
        if (result) {
          toast.success('Watch subscription started successfully', {
            description: `Expires: ${new Date(result.expiration).toLocaleString()}`,
          })
        } else {
          const errorMsg = viewModel.state.error || 'Failed to start watch subscription'
          toast.error(errorMsg, {
            description: errorMsg.includes('GMAIL_PUBSUB_TOPIC') 
              ? 'Please set GMAIL_PUBSUB_TOPIC in .env.local'
              : 'Check your configuration and try again',
          })
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setWatchLoading(false)
    }
  }

  const handleProcessAll = async () => {
    setProcessingAll(true)
    try {
      const result = await viewModel.processAll({ maxEmails: 50 })
      if (result) {
        toast.success(`Processed ${result.emailsProcessed} emails`, {
          description: result.emailsFailed > 0 
            ? `${result.emailsFailed} emails failed to process`
            : 'All emails processed successfully',
        })
        await viewModel.getUnprocessedCount().then(setUnprocessedCount)
        await viewModel.loadEmails(1, 5, { archived: false })
      } else {
        toast.error(viewModel.state.error || 'Failed to process emails')
      }
    } catch (error) {
      toast.error('Failed to process emails', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setProcessingAll(false)
    }
  }

  const stats = {
    total: viewModel.total,
    completed: viewModel.state.data.filter((e) => e.status === 'completed').length,
    processing: viewModel.state.data.filter((e) => e.status === 'processing').length,
    failed: viewModel.state.data.filter((e) => e.status === 'failed').length,
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-muted-foreground">Email document processing system</p>
        </div>
        <div className="flex gap-2">
          <Link href="/daily-ops/inbox/upload">
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Manual Upload
            </Button>
          </Link>
          <Button
            onClick={handleProcessAll}
            disabled={processingAll || viewModel.state.loading}
            variant="default"
            className="flex items-center gap-2"
          >
            <Play className={`h-4 w-4 ${processingAll ? 'animate-pulse' : ''}`} />
            {processingAll ? 'Processing...' : 'Process All'}
          </Button>
          <Button
            onClick={handleToggleWatch}
            disabled={watchLoading}
            variant={viewModel.watchStatus.isWatching ? 'default' : 'outline'}
            className="flex items-center gap-2"
          >
            {viewModel.watchStatus.isWatching ? (
              <>
                <BellOff className="h-4 w-4" />
                Stop Watch
              </>
            ) : (
              <>
                <Bell className="h-4 w-4" />
                Start Watch
              </>
            )}
          </Button>
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Emails</CardTitle>
              <CardDescription>Latest 5 emails from inbox</CardDescription>
            </div>
            <Link href="/daily-ops/inbox/emails">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {viewModel.state.loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <InboxEmailList />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
