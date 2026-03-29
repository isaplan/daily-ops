/**
 * @registry-id: NotesDashboard
 * @created: 2026-01-16T22:00:00.000Z
 * @last-modified: 2026-02-14T00:00:00.000Z
 * @description: Notes dashboard component showing overview and quick access
 * @last-fix: [2026-02-14] Light theme to match /daily-work dashboard (white cards, gray text, blue links)
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useNoteViewModel.ts => Note ViewModel
 *   - app/lib/hooks/useAuth.ts => Auth hook
 *   - app/components/ui/** => Shadcn microcomponents
 * 
 * @exports-to:
 *   ✓ app/daily-work/notes/page.tsx => Uses NotesDashboard
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useNoteViewModel } from '@/lib/viewmodels/useNoteViewModel'
import { useAuth } from '@/lib/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Plus, Lock, Globe, CalendarRange } from 'lucide-react'
import Link from 'next/link'

export default function NotesDashboard() {
  const { user } = useAuth()
  const viewModel = useNoteViewModel()
  const router = useRouter()

  useEffect(() => {
    viewModel.loadNotes({})
  }, [viewModel.loadNotes])

  if (viewModel.notes.length === 0 && !viewModel.error) {
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
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Notes</h1>
          <p className="text-gray-700">Overview of your notes and quick access</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/daily-work/notes?create=true')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Note
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/daily-work/notes?create=true&template=weekly')}
          >
            <CalendarRange className="h-4 w-4 mr-2" />
            Create Weekly
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white border rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">My Private Notes</CardTitle>
            <Lock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{myPrivateNotes.length}</div>
            <p className="text-xs text-gray-500 mt-1">Notes only you can see</p>
            <Link href="/daily-work/notes/my-notes" className="text-sm text-blue-600 hover:underline mt-2 inline-block cursor-pointer py-1.5 pr-1 -my-1 select-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">
              View all
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white border rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Public Notes</CardTitle>
            <Globe className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{publicNotes.length}</div>
            <p className="text-xs text-gray-500 mt-1">Shared with teams/locations</p>
            <Link href="/daily-work/notes/public-notes" className="text-sm text-blue-600 hover:underline mt-2 inline-block cursor-pointer py-1.5 pr-1 -my-1 select-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">
              View all
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white border rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{allNotes.length}</div>
            <p className="text-xs text-gray-500 mt-1">All your notes</p>
            <Link href="/daily-work/notes" className="text-sm text-blue-600 hover:underline mt-2 inline-block cursor-pointer py-1.5 pr-1 -my-1 select-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded">
              View all
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Notes */}
      {recentNotes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Notes</h2>
            <Link href="/daily-work/notes" className="text-sm text-blue-600 hover:underline cursor-pointer py-1.5 pr-1 -my-1 select-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded inline-block">
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentNotes.map((note) => (
              <Link key={note._id} href={`/daily-work/notes/${note.slug || note._id}`}>
                <Card className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base line-clamp-2 text-gray-900">{note.title}</CardTitle>
                      {note.is_pinned && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs shrink-0">
                          📌
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{note.content}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{new Date(note.created_at).toLocaleDateString()}</span>
                      {note.connected_to?.team_id || note.connected_to?.location_id ? (
                        <Badge variant="outline" className="text-xs text-gray-600 border-gray-300">
                          <Globe className="h-3 w-3 mr-1" />
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-600 border-gray-300">
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
