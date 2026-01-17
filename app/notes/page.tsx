'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import NoteList from '../components/NoteList'
import NoteForm from '../components/NoteForm'
import NotesDashboard from '../components/notes/NotesDashboard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { noteService } from '@/lib/services/noteService'
import type { Note } from '@/lib/types/note.types'

function NotesContent() {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const createMode = searchParams.get('create') === 'true'

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

  const handleBack = () => {
    const returnTo = searchParams.get('returnTo')
    if (returnTo) {
      router.push(returnTo)
    } else {
      setSelectedNote(null)
      router.push('/notes')
    }
  }

  // Show dashboard if no note selected and not in create mode
  if (!selectedNote && !createMode) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <NotesDashboard />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : createMode ? (
          <div>
            <Button variant="outline" onClick={() => router.push('/notes')} className="mb-4">
              ← Back to Dashboard
            </Button>
            <NoteForm
              note={null}
              onSave={() => router.push('/notes')}
              onCancel={() => router.push('/notes')}
            />
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
        ) : (
          <NoteList />
        )}
      </div>
    </div>
  )
}

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <Skeleton className="h-12 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <NotesContent />
    </Suspense>
  )
}
