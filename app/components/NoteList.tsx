'use client';

import { useEffect, useState } from 'react';
import NoteForm from './NoteForm';

interface Note {
  _id: string;
  title: string;
  content: string;
  slug?: string | null;
  author_id?: { name: string; email: string };
  connected_to?: {
    location_id?: { _id: string; name: string };
    team_id?: { _id: string; name: string };
    member_id?: { _id: string; name: string };
  };
  tags?: string[];
  is_pinned: boolean;
  is_archived: boolean;
  status?: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export default function NoteList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [filter, setFilter] = useState({ location_id: '', team_id: '', member_id: '', archived: 'false' });

  const loadNotes = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.location_id) params.append('location_id', filter.location_id);
    if (filter.team_id) params.append('team_id', filter.team_id);
    if (filter.member_id) params.append('member_id', filter.member_id);
    if (filter.archived) params.append('archived', filter.archived);

    fetch(`/api/notes?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setNotes(data.data);
        } else {
          setError(data.error || 'Failed to load notes');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadNotes();
  }, [filter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadNotes();
      } else {
        setError(data.error || 'Failed to delete note');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  const handleArchive = async (note: Note) => {
    try {
      const res = await fetch(`/api/notes/${note._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...note, is_archived: !note.is_archived }),
      });
      const data = await res.json();
      if (data.success) {
        loadNotes();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive note');
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-700">Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Notes ({notes.length})</h2>
        <button
          onClick={() => {
            setEditingNote(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Create Note
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>}

      {showForm && (
        <NoteForm
          note={editingNote || undefined}
          onSave={() => {
            setShowForm(false);
            setEditingNote(null);
            loadNotes();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingNote(null);
          }}
        />
      )}

      {notes.length === 0 ? (
        <p className="text-gray-600">No notes found. Create one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <div
              key={note._id}
              className={`p-4 bg-white border rounded-lg shadow-sm ${
                note.is_pinned ? 'border-yellow-400 border-2' : ''
              }`}
            >
              {note.is_pinned && (
                <span className="text-xs text-yellow-600 font-semibold">📌 PINNED</span>
              )}
              <h3 className="font-semibold text-lg text-gray-900 mb-2 mt-1">{note.title}</h3>
              <p className="text-sm text-gray-700 mb-3 line-clamp-3">{note.content}</p>
              
              {note.connected_to && (
                <div className="text-xs text-gray-600 mb-2 space-y-1">
                  {note.connected_to.location_id && typeof note.connected_to.location_id === 'object' && note.connected_to.location_id.name && (
                    <div>
                      📍{' '}
                      <a
                        href={`/locations/${note.connected_to.location_id._id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/locations/${note.connected_to.location_id._id}`;
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {note.connected_to.location_id.name}
                      </a>
                    </div>
                  )}
                  {note.connected_to.team_id && typeof note.connected_to.team_id === 'object' && note.connected_to.team_id.name && (
                    <div>
                      👥{' '}
                      <a
                        href={`/teams/${note.connected_to.team_id._id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/teams/${note.connected_to.team_id._id}`;
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {note.connected_to.team_id.name}
                      </a>
                    </div>
                  )}
                  {note.connected_to.member_id && typeof note.connected_to.member_id === 'object' && note.connected_to.member_id.name && (
                    <div>
                      👤{' '}
                      <a
                        href={`/members/${note.connected_to.member_id._id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/members/${note.connected_to.member_id._id}`;
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {note.connected_to.member_id.name}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {note.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-500 mb-3">
                by{' '}
                {note.author_id ? (
                  <a
                    href={`/members/${note.author_id._id || note.author_id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/members/${note.author_id._id || note.author_id}`;
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {note.author_id.name || 'Unknown'}
                  </a>
                ) : (
                  'Unknown'
                )}{' '}
                • {new Date(note.created_at).toLocaleDateString()}
              </div>

              <div className="flex gap-2">
                <a
                  href={`/notes/${note.slug || note._id}`}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 inline-block"
                >
                  View
                </a>
                <button
                  onClick={() => handleArchive(note)}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {note.is_archived ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  onClick={() => handleDelete(note._id)}
                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
