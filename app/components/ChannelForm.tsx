'use client';

import { useState, useEffect } from 'react';

interface Location {
  _id: string;
  name: string;
}

interface Team {
  _id: string;
  name: string;
}

interface Member {
  _id: string;
  name: string;
}

interface ChannelFormProps {
  channel?: { _id: string; name: string; description?: string; type: string; members?: Array<{ _id: string }> };
  onSave: () => void;
  onCancel: () => void;
}

export default function ChannelForm({ channel, onSave, onCancel }: ChannelFormProps) {
  const [formData, setFormData] = useState({
    name: channel?.name || '',
    description: channel?.description || '',
    type: channel?.type || 'general',
    location_id: channel?.connected_to?.location_id?._id || '',
    team_id: channel?.connected_to?.team_id?._id || '',
    member_id: channel?.connected_to?.member_id?._id || '',
    members: channel?.members?.map((m: { _id: string }) => m._id) || [],
  });

  const [locations, setLocations] = useState<Location[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
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
        if (data.success) setAllMembers(data.data);
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
      const payload = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        location_id: formData.location_id || undefined,
        team_id: formData.team_id || undefined,
        member_id: formData.member_id || undefined,
        members: formData.members,
        created_by: allMembers[0]?._id || '',
      };

      const url = channel?._id ? `/api/channels/${channel._id}` : '/api/channels';
      const method = channel?._id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        onSave();
      } else {
        setError(data.error || 'Failed to save channel');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save channel');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (memberId: string) => {
    if (formData.members.includes(memberId)) {
      setFormData({
        ...formData,
        members: formData.members.filter((id: string) => id !== memberId),
      });
    } else {
      setFormData({
        ...formData,
        members: [...formData.members, memberId],
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white border rounded-lg space-y-4">
      <div>
        <input
          type="text"
          placeholder="Channel Name (e.g., general, keuken) *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          className="w-full px-3 py-2 border rounded bg-white text-gray-900 text-lg font-semibold"
        />
      </div>

      <div>
        <textarea
          placeholder="Description (optional)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded bg-white text-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          required
          className="w-full px-3 py-2 border rounded bg-white text-gray-900"
        >
          <option value="general">General</option>
          <option value="location">Location</option>
          <option value="team">Team</option>
          <option value="member">Member</option>
          <option value="project">Project</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <select
            value={formData.location_id}
            onChange={(e) => setFormData({ ...formData, location_id: e.target.value, team_id: '' })}
            className="w-full px-3 py-2 border rounded bg-white text-gray-900"
          >
            <option value="">Select Location (Optional)</option>
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
            <option value="">Select Team (Optional)</option>
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
            <option value="">Select Member (Optional)</option>
            {allMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Add Members</label>
        <div className="max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
          {allMembers.map((member) => (
            <label key={member._id} className="flex items-center gap-2 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.members.includes(member._id)}
                onChange={() => toggleMember(member._id)}
                className="rounded"
              />
              <span className="text-sm text-gray-900">{member.name}</span>
            </label>
          ))}
        </div>
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
          {loading ? 'Saving...' : channel ? 'Update Channel' : 'Create Channel'}
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
