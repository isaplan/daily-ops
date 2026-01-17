'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import NoteList from '@/components/NoteList'
import NoteForm from '@/components/NoteForm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { noteService } from '@/lib/services/noteService'
import { useNoteViewModel } from '@/lib/viewmodels/useNoteViewModel'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Note } from '@/lib/types/note.types'

function PublicNotesContent() {
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

  // Load all notes, then filter for owned and connected notes
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
      setSelectedNote(null)
    }
  }

  // Filter notes to show owned notes and connected notes
  const publicNotes = viewModel.notes.filter((note) => {
    // If no user, show all notes with team/location connections (for development)
    if (!user?.id) {
      const hasTeamConnection = note.connected_to?.team_id
      const hasLocationConnection = note.connected_to?.location_id
      return hasTeamConnection || hasLocationConnection
    }
    
    // Check if note is owned by the user (handle both string and object formats)
    const authorId = typeof note.author_id === 'string' 
      ? note.author_id 
      : note.author_id?._id || note.author_id
    
    // Convert both to strings for comparison
    const isOwned = String(authorId) === String(user.id)
    
    // Check if note is connected (has team or location connection)
    const hasTeamConnection = note.connected_to?.team_id
    const hasLocationConnection = note.connected_to?.location_id
    const isConnected = hasTeamConnection || hasLocationConnection
    
    // Show notes that are either owned by the user OR connected to teams/locations
    return isOwned || isConnected
  })

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Public Notes</h1>
          <p className="text-muted-foreground">
            All notes you own and all notes connected to your teams and locations
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
              <h2 className="text-2xl font-bold">Public Notes ({publicNotes.length})</h2>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-slate-500">
                  Total notes loaded: {viewModel.notes.length} | User ID: {user?.id || 'Not authenticated'}
                </p>
              )}
            </div>
            {publicNotes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {viewModel.notes.length === 0 
                    ? 'No notes found. Make sure you have run the seed script to create dummy data.'
                    : 'No public notes available. Public notes are notes you own or notes connected to your teams and locations.'}
                </p>
                <Button
                  onClick={() => router.push('/notes?create=true')}
                  className="mt-4"
                >
                  Create Note
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicNotes.map((note) => (
                  <div
                    key={note._id}
                    className="border border-white/10 rounded-lg p-4 bg-slate-900/70 hover:bg-slate-900/90 transition-colors cursor-pointer"
                    onClick={() => router.push(`/notes/${note.slug || note._id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg text-white line-clamp-2">{note.title}</h3>
                      {note.is_pinned && (
                        <span className="text-yellow-400 text-sm">📌</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-3 mb-3">
                      {note.content}
                    </p>
                    {note.connected_to && (
                      <div className="text-xs text-slate-400 mb-2 space-y-1">
                        {note.connected_to.team_id && (
                          <div className="flex items-center gap-1">
                            <span>👥</span>
                            <span>{typeof note.connected_to.team_id === 'object' ? note.connected_to.team_id.name : 'Team'}</span>
                          </div>
                        )}
                        {note.connected_to.location_id && (
                          <div className="flex items-center gap-1">
                            <span>📍</span>
                            <span>{typeof note.connected_to.location_id === 'object' ? note.connected_to.location_id.name : 'Location'}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {note.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 flex items-center justify-between">
                      <span>
                        by {note.author_id && typeof note.author_id === 'object' ? note.author_id.name : 'Unknown'} • {new Date(note.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-slate-400">🌐 Public</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PublicNotesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <Skeleton className="h-12 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PublicNotesContent />
    </Suspense>
  )
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
