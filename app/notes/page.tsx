'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import NoteList from '../components/NoteList';
import NoteForm from '../components/NoteForm';
import type { INote } from '@/models/Note';

function NotesContent() {
  const [selectedNote, setSelectedNote] = useState<INote | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const noteId = searchParams.get('note');
    if (noteId) {
      fetch(`/api/notes/${noteId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSelectedNote(data.data);
          }
        });
    } else {
      setSelectedNote(null);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Notes</h1>
          <p className="text-gray-700">Create and manage notes connected to locations, teams, and members</p>
        </div>
        
        {selectedNote ? (
          <div>
            <button
              onClick={() => {
                const returnTo = searchParams.get('returnTo');
                if (returnTo) {
                  router.push(returnTo);
                } else {
                  setSelectedNote(null);
                }
              }}
              className="mb-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2"
            >
              <span>←</span> Back
            </button>
            <NoteForm
              note={selectedNote}
              onSave={() => {
                const returnTo = searchParams.get('returnTo');
                if (returnTo) {
                  router.push(returnTo);
                } else {
                  setSelectedNote(null);
                }
              }}
              onCancel={() => {
                const returnTo = searchParams.get('returnTo');
                if (returnTo) {
                  router.push(returnTo);
                } else {
                  setSelectedNote(null);
                }
              }}
            />
          </div>
        ) : (
          <NoteList />
        )}
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <NotesContent />
    </Suspense>
  );
}
