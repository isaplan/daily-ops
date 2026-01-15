'use client';

import { useState, useEffect } from 'react';

interface Location {
  _id: string;
  name: string;
}

interface Team {
  _id: string;
  name: string;
  location_id?: string | { _id: string };
}

interface Member {
  _id: string;
  name: string;
}

interface Note {
  _id?: string;
  title: string;
  content: string;
  slug?: string;
  author_id?: string;
  connected_to?: {
    location_id?: string | { _id: string; name: string };
    team_id?: string | { _id: string; name: string };
    member_id?: string | { _id: string; name: string };
  };
  tags?: string[];
  is_pinned?: boolean;
  status?: 'draft' | 'published';
}

interface NoteFormProps {
  note?: Note;
  onSave: () => void;
  onCancel: () => void;
}

export default function NoteForm({ note, onSave, onCancel }: NoteFormProps) {
  const [formData, setFormData] = useState({
    title: note?.title || '',
    content: note?.content || '',
    location_id: note?.connected_to?.location_id 
      ? (typeof note.connected_to.location_id === 'object' ? note.connected_to.location_id._id : note.connected_to.location_id)
      : '',
    team_id: note?.connected_to?.team_id
      ? (typeof note.connected_to.team_id === 'object' ? note.connected_to.team_id._id : note.connected_to.team_id)
      : '',
    member_id: note?.connected_to?.member_id
      ? (typeof note.connected_to.member_id === 'object' ? note.connected_to.member_id._id : note.connected_to.member_id)
      : '',
    tags: (note?.tags || []).join(', '),
    is_pinned: note?.is_pinned || false,
  });

  const [locations, setLocations] = useState<Location[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLocations(data.data);
      });
    
    fetch('/api/teams')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setTeams(data.data);
      });
    
    fetch('/api/members')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setMembers(data.data);
      });
  }, []);

  useEffect(() => {
    if (formData.location_id) {
      const filtered = teams.filter((t) => {
        const teamLocId = typeof t.location_id === 'object' ? t.location_id._id : t.location_id;
        return teamLocId === formData.location_id;
      });
      setFilteredTeams(filtered);
      if (formData.team_id && !filtered.find((t) => t._id === formData.team_id)) {
        setFormData({ ...formData, team_id: '' });
      }
    } else {
      setFilteredTeams(teams);
    }
  }, [formData.location_id, teams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tagsArray = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const payload = {
        title: formData.title,
        content: formData.content,
        author_id: note?.author_id || members[0]?._id || '',
        location_id: formData.location_id || undefined,
        team_id: formData.team_id || undefined,
        member_id: formData.member_id || undefined,
        tags: tagsArray,
        is_pinned: formData.is_pinned,
      };

      const url = note?._id ? `/api/notes/${note._id}` : '/api/notes';
      const method = note?._id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        onSave();
      } else {
        setError(data.error || 'Failed to save note');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white border rounded-lg space-y-4">
      <div>
        <input
          type="text"
          placeholder="Note Title *"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          className="w-full px-3 py-2 border rounded bg-white text-gray-900 text-lg font-semibold"
        />
      </div>

      <div>
        <textarea
          placeholder="Note Content *"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          required
          rows={8}
          className="w-full px-3 py-2 border rounded bg-white text-gray-900"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <select
            value={formData.location_id}
            onChange={(e) => setFormData({ ...formData, location_id: e.target.value, team_id: '' })}
            className="w-full px-3 py-2 border rounded bg-white text-gray-900"
          >
            <option value="">Select Location</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
          <select
            value={formData.team_id}
            onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
            disabled={!formData.location_id}
            className="w-full px-3 py-2 border rounded bg-white text-gray-900 disabled:bg-gray-100"
          >
            <option value="">Select Team</option>
            {filteredTeams.map((team) => (
              <option key={team._id} value={team._id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
          <select
            value={formData.member_id}
            onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
            className="w-full px-3 py-2 border rounded bg-white text-gray-900"
          >
            <option value="">Select Member</option>
            {members.map((member) => (
              <option key={member._id} value={member._id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
        <input
          type="text"
          placeholder="tag1, tag2, tag3"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          className="w-full px-3 py-2 border rounded bg-white text-gray-900"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="is_pinned"
          checked={formData.is_pinned}
          onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="is_pinned" className="text-sm text-gray-700">
          Pin this note
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Note'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
