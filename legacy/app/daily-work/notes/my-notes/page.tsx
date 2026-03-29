'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { noteService } from '@/lib/services/noteService'
import { useNoteViewModel } from '@/lib/viewmodels/useNoteViewModel'
import { useAuth } from '@/lib/hooks/useAuth'
import { Lock } from 'lucide-react'
import type { Note } from '@/lib/types/note.types'

const NoteForm = dynamic(() => import('@/components/NoteForm'), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
})

function MyNotesContent() {
  const { user } = useAuth()
  const viewModel = useNoteViewModel()
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    const noteId = searchParams.get('note')
    if (noteId) {
      setLoading(true)
      noteService
        .getById(noteId)
        .then((response) => {
          if (response.success && response.data) {
            setSelectedNote(response.data)
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      setSelectedNote(null)
    }
  }, [searchParams])

  // Load all notes, then filter for owned private notes
  useEffect(() => {
    // Only load once on mount
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      viewModel.loadNotes({})
    }
  }, [viewModel.loadNotes])

  const handleBack = () => {
    const returnTo = searchParams.get('returnTo')
    if (returnTo) {
      router.push(returnTo)
    } else {
      router.back()
    }
  }

  // Filter notes to show only owned private notes
  const myPrivateNotes = viewModel.notes.filter((note) => {
    // If no user, show all private notes (for development)
    if (!user?.id) {
      const hasTeamConnection = note.connected_to?.team_id
      const hasLocationConnection = note.connected_to?.location_id
      return !hasTeamConnection && !hasLocationConnection
    }
    
    // Check if note is owned by the user (handle both string and object formats)
    const authorId = typeof note.author_id === 'string' 
      ? note.author_id 
      : note.author_id?._id || note.author_id
    
    // Convert both to strings for comparison
    const isOwned = String(authorId) === String(user.id)
    
    if (!isOwned) return false
    
    // Check if note is private (no team or location connections)
    const hasTeamConnection = note.connected_to?.team_id
    const hasLocationConnection = note.connected_to?.location_id
    const isPrivate = !hasTeamConnection && !hasLocationConnection
    
    return isPrivate
  })

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 -ml-2 text-gray-600 hover:text-gray-900">
            ← Back
          </Button>
          <h1 className="text-4xl font-bold mb-2 text-gray-900">My Notes</h1>
          <p className="text-gray-700">
            Your private notes - notes you own that are not connected to teams or locations
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : selectedNote ? (
          <div>
            <Button variant="outline" onClick={handleBack} className="mb-4">
              ← Back
            </Button>
            <NoteForm
              note={selectedNote}
              onSave={handleBack}
              onCancel={handleBack}
            />
          </div>
        ) : viewModel.loading && viewModel.notes.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Private Notes ({myPrivateNotes.length})</h2>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-gray-500">
                  Total notes loaded: {viewModel.notes.length} | User ID: {user?.id || 'Not authenticated'}
                </p>
              )}
            </div>
            {myPrivateNotes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  {viewModel.notes.length === 0 
                    ? 'No notes found. Make sure you have run the seed script to create dummy data.'
                    : 'You don\'t have any private notes yet. Private notes are notes you own that are not connected to teams or locations.'}
                </p>
                <Button
                  onClick={() => router.push('/daily-work/notes?create=true')}
                  className="mt-4"
                >
                  Create Note
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myPrivateNotes.map((note) => (
                  <Link key={note._id} href={`/daily-work/notes/${note.slug || note._id}`}>
                    <Card className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
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
                        <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                          {note.content}
                        </p>
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {note.tags.slice(0, 3).map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 flex items-center justify-between">
                          <span>{new Date(note.created_at).toLocaleDateString()}</span>
                          <Badge variant="outline" className="text-xs text-gray-600 border-gray-300">
                            <Lock className="h-3 w-3 mr-1" />
                            Private
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MyNotesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <Skeleton className="h-12 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <MyNotesContent />
    </Suspense>
  )
}

