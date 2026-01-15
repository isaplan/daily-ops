'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Note {
  _id: string;
  title: string;
  content: string;
  slug: string;
  author_id?: { _id: string; name: string; email: string };
  connected_to?: {
    location_id?: { _id: string; name: string };
    team_id?: { _id: string; name: string };
    member_id?: { _id: string; name: string };
  };
  tags?: string[];
  is_pinned: boolean;
  is_archived: boolean;
  status: 'draft' | 'published';
  published_at?: string;
  created_at: string;
  updated_at: string;
}

interface NoteDetailPageProps {
  slug: string;
}

export default function NoteDetailPage({ slug }: NoteDetailPageProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    content: '',
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchNote();
  }, [slug]);

  const fetchNote = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/notes/${slug}`);
      const data = await res.json();
      if (data.success) {
        setNote(data.data);
        setEditData({ title: data.data.title, content: data.data.content });
      } else {
        setError(data.error || 'Failed to load note');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!note) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/notes/${note._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editData.title,
          content: editData.content,
          location_id: note.connected_to?.location_id?._id,
          team_id: note.connected_to?.team_id?._id,
          member_id: note.connected_to?.member_id?._id,
          tags: note.tags,
          is_pinned: note.is_pinned,
          is_archived: note.is_archived,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNote(data.data);
        setIsEditing(false);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!note) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/notes/${note._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          location_id: note.connected_to?.location_id?._id,
          team_id: note.connected_to?.team_id?._id,
          member_id: note.connected_to?.member_id?._id,
          tags: note.tags,
          is_pinned: note.is_pinned,
          is_archived: note.is_archived,
          publish: note.status === 'draft',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNote(data.data);
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePin = async () => {
    if (!note) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/notes/${note._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          location_id: note.connected_to?.location_id?._id,
          team_id: note.connected_to?.team_id?._id,
          member_id: note.connected_to?.member_id?._id,
          tags: note.tags,
          is_pinned: !note.is_pinned,
          is_archived: note.is_archived,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNote(data.data);
      } else {
        setError(data.error || 'Failed to update pin status');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!note) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/notes/${note._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          location_id: note.connected_to?.location_id?._id,
          team_id: note.connected_to?.team_id?._id,
          member_id: note.connected_to?.member_id?._id,
          tags: note.tags,
          is_pinned: note.is_pinned,
          is_archived: !note.is_archived,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNote(data.data);
      } else {
        setError(data.error || 'Failed to update archive status');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    if (!note) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/notes/${note._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        window.location.href = '/notes';
      } else {
        setError(data.error || 'Failed to delete');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-6 bg-gray-200 rounded mb-8"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <Link href="/notes" className="text-blue-600 hover:text-blue-800 mb-8 inline-block">
            ← Back to Notes
          </Link>
          <div className="bg-white p-8 rounded-lg border border-red-200">
            <p className="text-red-700">{error || 'Note not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <Link href="/notes" className="text-blue-600 hover:text-blue-800 mb-6 inline-block">
          ← Back to Notes
        </Link>

        {error && <div className="mb-4 p-4 bg-red-50 text-red-700 rounded">{error}</div>}

        <div className="bg-white rounded-lg shadow-sm border p-8 mb-6">
          {/* Header with status badge */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="w-full text-3xl font-bold mb-2 px-2 py-1 border rounded bg-white text-gray-900"
                />
              ) : (
                <h1 className="text-3xl font-bold mb-2 text-gray-900">{note.title}</h1>
              )}
              {note.is_pinned && <span className="text-xs text-yellow-600 font-semibold">📌 PINNED</span>}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                note.status === 'published'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {note.status.charAt(0).toUpperCase() + note.status.slice(1)}
            </span>
          </div>

          {/* Metadata */}
          <div className="text-sm text-gray-600 mb-6 space-y-1">
            {note.author_id && (
              <div>
                <strong>Author:</strong>{' '}
                <Link href={`/members/${note.author_id._id}`} className="text-blue-600 hover:text-blue-800">
                  {note.author_id.name}
                </Link>
              </div>
            )}
            <div>
              <strong>Created:</strong> {new Date(note.created_at).toLocaleDateString()}
            </div>
            {note.published_at && (
              <div>
                <strong>Published:</strong> {new Date(note.published_at).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Connections */}
          {note.connected_to && (
            <div className="mb-6 p-4 bg-gray-50 rounded space-y-2">
              {note.connected_to.location_id && (
                <div className="text-sm">
                  📍{' '}
                  <Link href={`/locations/${note.connected_to.location_id._id}`} className="text-blue-600 hover:text-blue-800">
                    {note.connected_to.location_id.name}
                  </Link>
                </div>
              )}
              {note.connected_to.team_id && (
                <div className="text-sm">
                  👥{' '}
                  <Link href={`/teams/${note.connected_to.team_id._id}`} className="text-blue-600 hover:text-blue-800">
                    {note.connected_to.team_id.name}
                  </Link>
                </div>
              )}
              {note.connected_to.member_id && (
                <div className="text-sm">
                  👤{' '}
                  <Link href={`/members/${note.connected_to.member_id._id}`} className="text-blue-600 hover:text-blue-800">
                    {note.connected_to.member_id.name}
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          {isEditing ? (
            <textarea
              value={editData.content}
              onChange={(e) => setEditData({ ...editData, content: e.target.value })}
              rows={12}
              className="w-full px-3 py-2 border rounded bg-white text-gray-900 mb-6 font-mono text-sm"
            />
          ) : (
            <div className="prose prose-sm max-w-none mb-6 text-gray-700 whitespace-pre-wrap">{note.content}</div>
          )}

          {/* Actions */}
          <div className="border-t pt-6 flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData({ title: note.title, content: note.content });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  ✎ Edit
                </button>
                <button
                  onClick={handlePublish}
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded ${
                    note.status === 'published'
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:opacity-50`}
                >
                  {actionLoading ? '...' : note.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={handlePin}
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded ${
                    note.is_pinned ? 'bg-yellow-600 text-white hover:bg-yellow-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } disabled:opacity-50`}
                >
                  {note.is_pinned ? '📌 Unpin' : '📌 Pin'}
                </button>
                <button
                  onClick={handleArchive}
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded ${
                    note.is_archived ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } disabled:opacity-50`}
                >
                  {note.is_archived ? '📦 Restore' : '📦 Archive'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 ml-auto"
                >
                  🗑️ Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
