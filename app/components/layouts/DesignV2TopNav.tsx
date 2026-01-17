/**
 * @registry-id: DesignV2TopNav
 * @created: 2026-01-16T15:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Top navigation bar for Design V2 with Notes, Actions, Projects, Events and action buttons
 * @last-fix: [2026-01-16] Wired up create buttons to proper routes with loading states and feedback
 * 
 * @imports-from:
 *   - app/components/ui/button.tsx => Button component
 *   - app/components/ui/popover.tsx => Popover for dropdowns
 *   - app/components/ui/input.tsx => Input for search
 *   - app/components/ui/alert.tsx => Alert for feedback
 * 
 * @exports-to:
 *   ✓ app/components/layouts/DesignV2Layout.tsx => Top navigation bar
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { searchService, type SearchResult } from '@/lib/services/searchService'
import { notificationService, type Notification } from '@/lib/services/notificationService'
import { cn } from '@/lib/utils/cn'
import {
  FileText,
  CheckSquare,
  Target,
  Calendar,
  Search,
  Bell,
  Plus,
  MessageSquare,
} from 'lucide-react'

const navItems = [
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/todos', label: 'Actions', icon: CheckSquare },
  { href: '/decisions', label: 'Projects', icon: Target },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/chats', label: 'Chats', icon: MessageSquare },
]

const createOptions = [
  { label: 'Note', icon: FileText, href: '/notes?create=true' },
  { label: 'Task', icon: CheckSquare, href: '/todos?create=true' },
  { label: 'Decision', icon: Target, href: '/decisions?create=true' },
  { label: 'Project', icon: Target, href: '/decisions?create=true&type=project' },
  { label: 'Event', icon: Calendar, href: '/events?create=true' },
]

export default function DesignV2TopNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Load notifications on mount
  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true)
      const response = await notificationService.getAll({ limit: 10 })
      if (response.success && response.data) {
        setNotifications(response.data.notifications)
        setUnreadCount(response.data.notifications.filter((n) => !n.read).length)
      }
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setNotificationsLoading(false)
    }
  }

  const handleCreate = async (href: string) => {
    try {
      setCreateLoading(true)
      setCreateError(null)
      setCreateOpen(false)
      router.push(href)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to navigate')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    try {
      setSearchLoading(true)
      setSearchError(null)
      const response = await searchService.search({
        q: searchQuery.trim(),
        types: ['note', 'todo', 'decision', 'event'],
        limit: 10,
      })

      if (response.success && response.data) {
        setSearchResults(response.data.results)
      } else {
        setSearchError(response.error || 'Search failed')
        setSearchResults([])
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    let href = ''
    switch (result.type) {
      case 'note':
        href = result.slug ? `/notes/${result.slug}` : `/notes/${result.id}`
        break
      case 'todo':
        href = `/todos?todo=${result.id}`
        break
      case 'decision':
        href = `/decisions?id=${result.id}`
        break
      case 'event':
        href = `/events/${result.id}`
        break
    }
    if (href) {
      router.push(href)
      setSearchOpen(false)
      setSearchQuery('')
      setSearchResults([])
    }
  }

  return (
    <header className="border-b border-white/10 bg-slate-900/90 px-6 py-4 backdrop-blur shadow-lg shadow-black/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const IconComponent = item.icon
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/80 via-blue-600 to-slate-900/70 text-white shadow-lg shadow-black/60'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <IconComponent className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Search Icon with Popover */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-300 hover:text-white"
              >
                <Search className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 bg-slate-800 border-white/10" align="end">
              <form onSubmit={handleSearch} className="space-y-3">
                <Input
                  type="search"
                  placeholder="Search notes, tasks, decisions..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (e.target.value.trim()) {
                      handleSearch(e as unknown as React.FormEvent)
                    } else {
                      setSearchResults([])
                    }
                  }}
                  className="bg-slate-900 border-white/10 text-white placeholder:text-slate-400"
                  autoFocus
                />
                {searchError && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">{searchError}</AlertDescription>
                  </Alert>
                )}
                {searchLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {searchResults.map((result) => (
                      <Card
                        key={`${result.type}-${result.id}`}
                        className="cursor-pointer hover:bg-slate-700/50 transition-colors"
                        onClick={() => handleResultClick(result)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs">
                                  {result.type}
                                </Badge>
                                <span className="text-sm font-semibold text-white truncate">
                                  {result.title}
                                </span>
                              </div>
                              {(result.content || result.description) && (
                                <p className="text-xs text-slate-400 line-clamp-2">
                                  {result.content || result.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : searchQuery.trim() && !searchLoading ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No results found
                  </p>
                ) : null}
              </form>
            </PopoverContent>
          </Popover>

          {/* Notifications Icon with Popover */}
          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-300 hover:text-white relative"
              >
                <Bell className="h-4 w-4" />
                {/* Notification badge */}
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-slate-800 border-white/10" align="end">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white mb-2">Notifications</h3>
                {notificationsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : notifications.length === 0 ? (
                  <p className="text-xs text-slate-400">No notifications</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {notifications.map((notification) => (
                      <Card
                        key={notification._id}
                        className={cn(
                          'cursor-pointer hover:bg-slate-700/50 transition-colors',
                          !notification.read && 'border-primary/50 bg-primary/5'
                        )}
                        onClick={async () => {
                          if (!notification.read) {
                            await notificationService.markAsRead(notification._id)
                            loadNotifications()
                          }
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white">
                                {notification.title}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {notification.message}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Create (+) Icon with Popover */}
          <Popover open={createOpen} onOpenChange={setCreateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-300 hover:text-white bg-gradient-to-br from-indigo-500/20 to-blue-500/20 hover:from-indigo-500/30 hover:to-blue-500/30"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 bg-slate-800 border-white/10 p-2" align="end">
              <div className="space-y-1">
                {createError && (
                  <Alert variant="destructive" className="mb-2">
                    <AlertDescription className="text-xs">{createError}</AlertDescription>
                  </Alert>
                )}
                {createOptions.map((option) => {
                  const IconComponent = option.icon
                  return (
                    <button
                      key={option.label}
                      onClick={() => handleCreate(option.href)}
                      disabled={createLoading}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconComponent className="h-4 w-4" />
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  )
}
