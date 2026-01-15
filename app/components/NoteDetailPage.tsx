'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ConnectedMember {
  member_id: { _id: string; name: string; email?: string } | string;
  role?: 'responsible' | 'attending' | 'reviewer' | 'contributor';
  added_at?: string;
}

interface Note {
  _id: string;
  title: string;
  content: string;
  slug?: string | null;
  author_id?: { _id: string; name: string; email: string };
  connected_to?: {
    location_id?: { _id: string; name: string };
    team_id?: { _id: string; name: string };
    member_id?: { _id: string; name: string };
  };
  connected_members?: ConnectedMember[];
  tags?: string[];
  is_pinned: boolean;
  is_archived: boolean;
  status: 'draft' | 'published';
  published_at?: string;
  created_at: string;
  updated_at: string;
}

interface Member {
  _id: string;
  name: string;
  email: string;
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
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'responsible' | 'attending' | 'reviewer' | 'contributor'>('contributor');

  useEffect(() => {
    if (slug && slug !== 'undefined') {
      fetchNote();
      fetchMembers();
    } else {
      setError('Invalid note identifier');
      setLoading(false);
    }
  }, [slug]);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMembers(data.data);
      } else {
        console.error('Invalid members response:', data);
        setMembers([]);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
      setMembers([]);
    }
  };

  const fetchNote = async () => {
    if (!slug || slug === 'undefined') {
      setError('Invalid note identifier');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/notes/${slug}`);
      const data = await res.json();
      if (data.success) {
        setNote(data.data);
        setEditData({ title: data.data.title, content: data.data.content });
      } else {
        setError(data.error || 'Failed to load note');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!note || !selectedMemberId) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/notes/${note._id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMemberId,
          role: selectedRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNote(data.data);
        setShowAddMember(false);
        setSelectedMemberId('');
      } else {
        setError(data.error || 'Failed to add member');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!note) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/notes/${note._id}/members?member_id=${memberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setNote(data.data);
      } else {
        setError(data.error || 'Failed to remove member');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const getMemberId = (member: ConnectedMember['member_id']): string => {
    return typeof member === 'object' ? member._id : member;
  };

  const getMemberName = (member: ConnectedMember['member_id']): string => {
    return typeof member === 'object' ? member.name : 'Unknown';
  };

  const handleParseTodos = async () => {
    if (!note) return;
    if (!confirm('This will parse todos from the note content and create them. Continue?')) return;
    
    try {
      setActionLoading(true);
      const res = await fetch(`/api/notes/${note._id}/parse-todos`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully created ${data.data.count} todo(s) from note content!`);
        fetchNote(); // Refresh note to show linked todos
      } else {
        setError(data.error || 'Failed to parse todos');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
              <div className="text-xs font-semibold text-gray-500 mb-2">READ ACCESS (Team/Location)</div>
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

          {/* Connected Members (Responsible/Attending) */}
          <div className="mb-6 p-4 bg-blue-50 rounded">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">RESPONSIBLE MEMBERS</div>
                <div className="text-xs text-gray-500">Members responsible for decisions, todos, and management</div>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  + Add Member
                </button>
              )}
            </div>

            {showAddMember && (
              <div className="mb-3 p-3 bg-white rounded border">
                {members.length === 0 ? (
                  <div className="text-sm text-gray-500 mb-2">
                    {members.length === 0 && !loading ? 'No members available' : 'Loading members...'}
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="w-full mb-2 px-3 py-2 border rounded text-gray-900"
                    >
                      <option value="">Select Member</option>
                      {members
                        .filter((m) => {
                          if (!note.connected_members || note.connected_members.length === 0) return true;
                          return !note.connected_members.some((cm) => getMemberId(cm.member_id) === m._id);
                        })
                        .map((member) => (
                          <option key={member._id} value={member._id}>
                            {member.name} ({member.email})
                          </option>
                        ))}
                    </select>
                    {members.filter((m) => {
                      if (!note.connected_members || note.connected_members.length === 0) return true;
                      return !note.connected_members.some((cm) => getMemberId(cm.member_id) === m._id);
                    }).length === 0 && (
                      <div className="text-xs text-gray-500 mb-2">All members are already connected to this note</div>
                    )}
                  </>
                )}
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
                  className="w-full mb-2 px-3 py-2 border rounded text-gray-900"
                >
                  <option value="contributor">Contributor</option>
                  <option value="attending">Attending</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="responsible">Responsible</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddMember}
                    disabled={!selectedMemberId || actionLoading}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMember(false);
                      setSelectedMemberId('');
                    }}
                    className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {note.connected_members && note.connected_members.length > 0 ? (
              <div className="space-y-2">
                {note.connected_members.map((cm, idx) => {
                  const memberId = getMemberId(cm.member_id);
                  const memberName = getMemberName(cm.member_id);
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center gap-2">
                        <Link href={`/members/${memberId}`} className="text-blue-600 hover:text-blue-800 font-medium">
                          {memberName}
                        </Link>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {cm.role || 'contributor'}
                        </span>
                      </div>
                      {!isEditing && (
                        <button
                          onClick={() => handleRemoveMember(memberId)}
                          disabled={actionLoading}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">No members connected yet</div>
            )}
          </div>

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

          {/* Linked Todos Info */}
          {note.linked_todos && note.linked_todos.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 rounded">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                📋 Linked Todos ({note.linked_todos.length})
              </div>
              <div className="text-xs text-gray-600">
                This note has {note.linked_todos.length} todo(s) linked to it. View them in the Todos section.
              </div>
            </div>
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
                  onClick={handleParseTodos}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  title="Parse todos from note content (format: @member_name: todo text [priority] [date])"
                >
                  📋 Parse Todos
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
