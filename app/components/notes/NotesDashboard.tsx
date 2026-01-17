/**
 * @registry-id: NotesDashboard
 * @created: 2026-01-16T22:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Notes dashboard component showing overview and quick access
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useNoteViewModel.ts => Note ViewModel
 *   - app/lib/hooks/useAuth.ts => Auth hook
 *   - app/components/ui/** => Shadcn microcomponents
 * 
 * @exports-to:
 *   ✓ app/notes/page.tsx => Uses NotesDashboard
 */

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useNoteViewModel } from '@/lib/viewmodels/useNoteViewModel'
import { useAuth } from '@/lib/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Plus, Lock, Globe } from 'lucide-react'
import Link from 'next/link'

export default function NotesDashboard() {
  const { user } = useAuth()
  const viewModel = useNoteViewModel()
  const router = useRouter()
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    // Only load once on mount
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      viewModel.loadNotes({})
    }
  }, [viewModel.loadNotes])

  if (viewModel.loading && viewModel.notes.length === 0 && !viewModel.error) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (viewModel.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{viewModel.error}</AlertDescription>
      </Alert>
    )
  }

  // Calculate stats
  const allNotes = viewModel.notes
  const myPrivateNotes = allNotes.filter((note) => {
    // If no user, show all private notes (for development)
    if (!user?.id) {
      const hasTeamConnection = note.connected_to?.team_id
      const hasLocationConnection = note.connected_to?.location_id
      return !hasTeamConnection && !hasLocationConnection
    }
    const authorId = typeof note.author_id === 'string' ? note.author_id : note.author_id?._id
    const isOwned = String(authorId) === String(user.id)
    const hasTeamConnection = note.connected_to?.team_id
    const hasLocationConnection = note.connected_to?.location_id
    const isPrivate = !hasTeamConnection && !hasLocationConnection
    return isOwned && isPrivate
  })

  const publicNotes = allNotes.filter((note) => {
    // If no user, show all notes with connections (for development)
    if (!user?.id) {
      const hasTeamConnection = note.connected_to?.team_id
      const hasLocationConnection = note.connected_to?.location_id
      return hasTeamConnection || hasLocationConnection
    }
    const authorId = typeof note.author_id === 'string' ? note.author_id : note.author_id?._id
    const isOwned = String(authorId) === String(user.id)
    const hasTeamConnection = note.connected_to?.team_id
    const hasLocationConnection = note.connected_to?.location_id
    const isConnected = hasTeamConnection || hasLocationConnection
    return isOwned || isConnected
  })

  const recentNotes = allNotes
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Notes Dashboard</h1>
          <p className="text-slate-400">Overview of your notes and quick access</p>
        </div>
        <Button
          onClick={() => router.push('/notes?create=true')}
          className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Note
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">My Private Notes</CardTitle>
            <Lock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{myPrivateNotes.length}</div>
            <p className="text-xs text-slate-400 mt-1">Notes only you can see</p>
            <Link href="/notes/my-notes">
              <Button variant="ghost" size="sm" className="mt-2 text-xs">
                View All →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Public Notes</CardTitle>
            <Globe className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{publicNotes.length}</div>
            <p className="text-xs text-slate-400 mt-1">Shared with teams/locations</p>
            <Link href="/notes/public-notes">
              <Button variant="ghost" size="sm" className="mt-2 text-xs">
                View All →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{allNotes.length}</div>
            <p className="text-xs text-slate-400 mt-1">All your notes</p>
            <Link href="/notes">
              <Button variant="ghost" size="sm" className="mt-2 text-xs">
                View All →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/notes?create=true">
          <Card className="border-white/10 bg-slate-900/70 hover:bg-slate-900/90 cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">Start a new note</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/notes/my-notes">
          <Card className="border-white/10 bg-slate-900/70 hover:bg-slate-900/90 cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5" />
                My Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">View your private notes</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/notes/public-notes">
          <Card className="border-white/10 bg-slate-900/70 hover:bg-slate-900/90 cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Public Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">View shared notes</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Notes */}
      {recentNotes.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Recent Notes</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentNotes.map((note) => (
              <Link key={note._id} href={`/notes/${note.slug || note._id}`}>
                <Card className="border-white/10 bg-slate-900/70 hover:bg-slate-900/90 cursor-pointer transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base line-clamp-2">{note.title}</CardTitle>
                      {note.is_pinned && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">
                          📌
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-400 line-clamp-2 mb-2">{note.content}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                      {note.connected_to?.team_id || note.connected_to?.location_id ? (
                        <Badge variant="outline" className="text-xs">
                          <Globe className="h-3 w-3 mr-1" />
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Private
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
