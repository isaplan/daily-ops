/**
 * @registry-id: DesignV2Sidebar
 * @created: 2026-01-16T15:00:00.000Z
 * @last-modified: 2026-01-16T21:15:00.000Z
 * @description: Modern sidebar for Design V2 with environment sections and Slack-like channel grouping
 * @last-fix: [2026-01-16] Made sidebar dynamic - only shows active environment section matching top nav
 * 
 * @imports-from:
 *   - app/components/ui/button.tsx => Button component
 *   - app/lib/designMode.tsx => Design mode context
 *   - app/lib/workspaceContext.tsx => Workspace context for location display
 * 
 * @exports-to:
 *   ✓ app/components/layouts/DesignV2Layout.tsx => Sidebar navigation
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useDesignMode } from '@/lib/designMode'
import { useWorkspace } from '@/lib/workspaceContext'
import { useEnvironment } from '@/lib/environmentContext'
import type { ChannelWithLinks } from '@/lib/types/chats.types'
import type { ApiResponse } from '@/lib/services/base'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Target,
  Calendar,
  MessageSquare,
  Hash,
  Building2,
  Palette,
  Plus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const WORKSPACE_NAMES: Record<string, { fullName: string; shortName: string }> = {
  hnh: { fullName: 'Haagse Nieuwe Horeca Groep', shortName: 'HNH' },
  vkb: { fullName: 'van Kinsbergen', shortName: 'VKB' },
  bea: { fullName: 'Bar Bea', shortName: 'BEA' },
  lat: { fullName: "l'AMour-Toujours", shortName: 'LAT' },
  'daily-ops': { fullName: 'Daily Ops HQ', shortName: 'Daily Ops' },
  all: { fullName: 'Daily Ops', shortName: 'Daily Ops' },
}

const environmentSections: Record<
  string,
  {
    label: string
    items: Array<{ href: string; label: string; icon: LucideIcon }>
  }
> = {
  collaboration: {
    label: 'Collaboration',
    items: [
      { href: '/collaboration', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/notes', label: 'Notes', icon: FileText },
      { href: '/todos', label: 'Todos', icon: CheckSquare },
      { href: '/decisions', label: 'Decisions', icon: Target },
      { href: '/events', label: 'Events', icon: Calendar },
    ],
  },
  chats: {
    label: 'Chats',
    items: [
      { href: '/chats', label: 'Chats', icon: MessageSquare },
      { href: '/channels', label: 'Channels', icon: Hash },
    ],
  },
  'daily-ops': {
    label: 'Daily Ops',
    items: [{ href: '/organization', label: 'Organization', icon: Building2 }],
  },
}

// Note-specific sidebar items
const noteSidebarItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/notes', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/notes?create=true', label: 'Create Note', icon: Plus },
  { href: '/notes/my-notes', label: 'My Notes', icon: FileText },
  { href: '/notes/public-notes', label: 'Public Notes', icon: FileText },
]

export default function DesignV2Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { mode, setMode } = useDesignMode()
  const { activeWorkspace } = useWorkspace()
  const { activeEnvironment } = useEnvironment()
  const [channels, setChannels] = useState<ChannelWithLinks[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const activeChannelId = searchParams.get('channelId')

  const modeOptions = [
    { id: 'v1', label: 'Classic' },
    { id: 'v2', label: 'Design V2' },
  ]

  const workspaceInfo = WORKSPACE_NAMES[activeWorkspace] || WORKSPACE_NAMES.all

  // Load channels when in chats environment or on channels/chats routes
  useEffect(() => {
    if (activeEnvironment === 'chats' || pathname.startsWith('/channels') || pathname.startsWith('/chats')) {
      loadChannels()
    }
  }, [activeEnvironment, pathname])

  const loadChannels = async () => {
    try {
      setChannelsLoading(true)
      const response = await fetch('/api/chats/channels')
      const data: ApiResponse<{ channels: ChannelWithLinks[]; total: number; skip: number; limit: number }> =
        await response.json()
      if (data.success && data.data) {
        setChannels(data.data.channels)
      }
    } catch (err) {
      console.error('Failed to load channels:', err)
    } finally {
      setChannelsLoading(false)
    }
  }

  const handleChannelClick = (channelId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('channelId', channelId)
    router.push(`/chats?${params.toString()}`)
  }

  // Group channels: Most Recent, Most Popular, Also you (DMs)
  const groupedChannels = (() => {
    if (channels.length === 0) return { mostRecent: [], mostPopular: [], alsoYou: [] }

    // Most Recent: sorted by created_at (newest first)
    const mostRecent = [...channels]
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA
      })
      .slice(0, 10) // Top 10 most recent

    // Most Popular: sorted by message count (highest first)
    const mostPopular = [...channels]
      .filter((c) => (c.messages_count || 0) > 0)
      .sort((a, b) => (b.messages_count || 0) - (a.messages_count || 0))
      .slice(0, 10) // Top 10 most popular

    // Also you: channels where user is a member or created by user
    // For now, we'll show channels with members (DMs) or small member count
    // TODO: Filter by actual current user ID when auth is implemented
    const alsoYou = channels.filter((channel) => {
      const hasMembers = channel.members && channel.members.length > 0
      const isSmallGroup = channel.members && channel.members.length <= 5
      return hasMembers && isSmallGroup
    })

    return { mostRecent, mostPopular, alsoYou }
  })()

  return (
    <aside className="w-64 border-r border-white/10 bg-slate-900/80 p-4 backdrop-blur">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">{workspaceInfo.shortName}</h1>
        <p className="text-xs uppercase tracking-tight text-slate-400">
          {activeWorkspace === 'all' ? 'POC' : workspaceInfo.fullName}
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        {modeOptions.map((option) => (
          <Button
            key={option.id}
            variant={mode === option.id ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 text-xs uppercase tracking-tight"
            onClick={() => setMode(option.id as 'v1' | 'v2')}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="space-y-6">
        {/* Show note-specific sidebar when on notes pages */}
        {pathname.startsWith('/notes') ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-tight text-slate-500">
              Notes
            </p>
            <nav className="space-y-1">
              {noteSidebarItems.map((item) => {
                let isActive = false
                if (item.href === '/notes?create=true') {
                  isActive = pathname === '/notes' && searchParams.get('create') === 'true'
                } else if (item.href === '/notes') {
                  // Dashboard is active when on /notes without query params
                  isActive = pathname === '/notes' && !searchParams.get('create') && !searchParams.get('note')
                } else {
                  isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                }
                const IconComponent = item.icon
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start gap-3 text-sm',
                        isActive
                          ? 'bg-gradient-to-r from-indigo-500/20 to-blue-500/20 text-white'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <IconComponent className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Button>
                  </Link>
                )
              })}
            </nav>
          </div>
        ) : (
          /* Only show the active environment's section */
          (() => {
            const activeSection = environmentSections[activeEnvironment]
            if (!activeSection) return null

            const isChatsSection = activeEnvironment === 'chats'
            return (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-tight text-slate-500">
                  {activeSection.label}
                </p>
                <nav className="space-y-1">
                  {activeSection.items.map((item) => {
                    const isActive = pathname === item.href && !activeChannelId
                    const IconComponent = item.icon
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant="ghost"
                          className={cn(
                            'w-full justify-start gap-3 text-sm',
                            isActive
                              ? 'bg-gradient-to-r from-indigo-500/20 to-blue-500/20 text-white'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          <IconComponent className="h-5 w-5" />
                          <span className="font-medium">{item.label}</span>
                        </Button>
                      </Link>
                    )
                  })}
                {/* Show channels grouped by sections when in chats environment */}
                {isChatsSection && (
                  <div className="ml-4 mt-2 space-y-4">
                    {channelsLoading ? (
                      <div className="space-y-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : channels.length === 0 ? (
                      <p className="text-xs text-slate-500 pl-3">No channels available</p>
                    ) : (
                      <>
                        {/* Most Recent */}
                        {groupedChannels.mostRecent.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-tight text-slate-500 pl-3">
                              Most Recent
                            </p>
                            <div className="space-y-1">
                              {groupedChannels.mostRecent.map((channel) => {
                                const isChannelActive = activeChannelId === channel._id
                                return (
                                  <Button
                                    key={channel._id}
                                    variant="ghost"
                                    onClick={() => handleChannelClick(channel._id)}
                                    className={cn(
                                      'w-full justify-start gap-2 text-sm pl-3',
                                      isChannelActive
                                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    )}
                                  >
                                    <Hash className="h-4 w-4" />
                                    <span className="truncate font-medium">{channel.name}</span>
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Most Popular */}
                        {groupedChannels.mostPopular.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-tight text-slate-500 pl-3">
                              Most Popular
                            </p>
                            <div className="space-y-1">
                              {groupedChannels.mostPopular.map((channel) => {
                                const isChannelActive = activeChannelId === channel._id
                                return (
                                  <Button
                                    key={channel._id}
                                    variant="ghost"
                                    onClick={() => handleChannelClick(channel._id)}
                                    className={cn(
                                      'w-full justify-start gap-2 text-sm pl-3',
                                      isChannelActive
                                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    )}
                                  >
                                    <Hash className="h-4 w-4" />
                                    <span className="truncate font-medium">{channel.name}</span>
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Also you (DMs) */}
                        {groupedChannels.alsoYou.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-tight text-slate-500 pl-3">
                              Also you
                            </p>
                            <div className="space-y-1">
                              {groupedChannels.alsoYou.map((channel) => {
                                const isChannelActive = activeChannelId === channel._id
                                return (
                                  <Button
                                    key={channel._id}
                                    variant="ghost"
                                    onClick={() => handleChannelClick(channel._id)}
                                    className={cn(
                                      'w-full justify-start gap-2 text-sm pl-3',
                                      isChannelActive
                                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    )}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="truncate font-medium">{channel.name}</span>
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                </nav>
              </div>
            )
          })()
        )}

        <div className="pt-4">
          <Link href="/design">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 text-sm',
                pathname === '/design'
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <span className="text-lg">🎨</span>
              <span className="font-medium">Design System</span>
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  )
}
