/**
 * @registry-id: NotesPage
 * @created: 2026-01-16T22:30:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Notes dashboard and editor entrypoint (migrated to /daily-work/notes)
 * @last-fix: [2026-01-24] Updated routing to /daily-work/notes
 */

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import NoteList from '@/components/NoteList'
import NoteForm from '@/components/NoteForm'
import NoteEditorV2 from '@/components/notes/NoteEditorV2'
import NotesDashboard from '@/components/notes/NotesDashboard'
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
      router.back()
    }
  }

  // Show dashboard if no note selected and not in create mode
  if (!selectedNote && !createMode) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 -ml-2 text-gray-600 hover:text-gray-900">
            ← Back
          </Button>
          <NotesDashboard key={`notes-list-${searchParams.toString()}`} />
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
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 -ml-2 text-gray-600 hover:text-gray-900">
              ← Back
            </Button>
            <NoteEditorV2
              note={null}
              initialTemplate={searchParams.get('template') === 'weekly' ? 'weekly' : undefined}
              onSave={() => router.push('/daily-work/notes')}
              onCancel={() => router.push('/daily-work/notes')}
            />
          </div>
        ) : selectedNote ? (
          <div>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 -ml-2 text-gray-600 hover:text-gray-900">
              ← Back
            </Button>
            <NoteEditorV2
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

