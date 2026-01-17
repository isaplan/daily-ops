/**
 * @registry-id: ChannelSidebar
 * @created: 2026-01-16T16:00:00.000Z
 * @last-modified: 2026-01-16T16:00:00.000Z
 * @description: Channel sidebar component using shadcn microcomponents only
 * @last-fix: [2026-01-16] Replaced emoji icon with Lucide React MessageSquare icon
 * 
 * @imports-from:
 *   - app/components/ui/** => Shadcn microcomponents only
 *   - app/lib/types/chats.types.ts => ChannelWithLinks type
 * 
 * @exports-to:
 *   ✓ app/components/chats/ChatsDashboard.tsx => Uses ChannelSidebar
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChannelWithLinks } from '@/lib/types/chats.types'
import { cn } from '@/lib/utils/cn'
import { MessageSquare } from 'lucide-react'

interface ChannelSidebarProps {
  channels: ChannelWithLinks[]
  activeChannelId: string | null
  onSelectChannel: (channelId: string) => Promise<void>
  loading: boolean
}

export default function ChannelSidebar({
  channels,
  activeChannelId,
  onSelectChannel,
  loading,
}: ChannelSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredChannels = channels.filter((channel) =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading && channels.length === 0) {
    return (
      <div className="w-64 border-r border-white/10 bg-slate-900/70 p-4">
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-64 border-r border-white/10 bg-slate-900/70 p-4 flex flex-col">
      <div className="mb-4">
        <Input
          placeholder="Search channels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-800/50 border-white/10 text-white"
        />
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {filteredChannels.map((channel) => {
          const isActive = channel._id === activeChannelId
          return (
            <Card
              key={channel._id}
              className={cn(
                'p-3 cursor-pointer transition-colors',
                isActive
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30'
                  : 'bg-slate-800/50 border-white/10 hover:bg-slate-800/70'
              )}
              onClick={() => onSelectChannel(channel._id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 flex-shrink-0" />
                    <p className="font-semibold text-white truncate">{channel.name}</p>
                  </div>
                  {channel.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{channel.description}</p>
                  )}
                </div>
              </div>
              {channel.linked_entities_count &&
                (channel.linked_entities_count.notes > 0 || channel.linked_entities_count.todos > 0) && (
                  <div className="flex gap-1 mt-2">
                    {channel.linked_entities_count.notes > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {channel.linked_entities_count.notes} notes
                      </Badge>
                    )}
                    {channel.linked_entities_count.todos > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {channel.linked_entities_count.todos} todos
                      </Badge>
                    )}
                  </div>
                )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
