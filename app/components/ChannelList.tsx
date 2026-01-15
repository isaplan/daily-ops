/**
 * @registry-id: ChannelListComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Channel list component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Refactored to use useChannelViewModel + microcomponents
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useChannelViewModel.ts => Channel ViewModel
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/channels/page.tsx => Uses ChannelList
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChannelViewModel } from '@/lib/viewmodels/useChannelViewModel'
import ChannelForm from './ChannelForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ChannelList() {
  const router = useRouter()
  const viewModel = useChannelViewModel()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    viewModel.loadChannels()
  }, [])

  if (viewModel.loading && viewModel.channels.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Channels</h2>
        <Button onClick={() => setShowForm(true)}>+ Create Channel</Button>
      </div>

      {viewModel.error && (
        <Alert variant="destructive">
          <AlertDescription>{viewModel.error}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <ChannelForm
          onSave={() => {
            setShowForm(false)
            viewModel.loadChannels()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {viewModel.channels.length === 0 ? (
        <EmptyState
          title="No channels found"
          description="Create your first channel to get started"
          action={{
            label: 'Create Channel',
            onClick: () => setShowForm(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {viewModel.channels.map((channel) => (
            <Card
              key={channel._id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/channels/${channel._id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>#{channel.name}</CardTitle>
                  <Badge variant="secondary">{channel.type}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {channel.description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {channel.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{channel.members?.length || 0} members</span>
                  {channel.created_by && (
                    <>
                      <span>•</span>
                      <span>
                        Created by{' '}
                        {typeof channel.created_by === 'object'
                          ? channel.created_by.name
                          : 'Unknown'}
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
