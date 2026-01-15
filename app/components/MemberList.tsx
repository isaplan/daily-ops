'use client';

import { useEffect, useState } from 'react';

interface Member {
  _id: string;
  name: string;
  email: string;
  slack_username?: string;
  is_active: boolean;
  location_id?: { name: string; _id?: string };
  team_id?: { name: string; _id?: string };
}

function MemberCard({ member, onOpenSheet }: { member: Member; onOpenSheet: (id: string, title: string) => void }) {
  return (
    <div 
      className="p-4 bg-white border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onOpenSheet(member._id, member.name)}
    >
      <h3 className="font-semibold text-lg text-gray-900 mb-1">{member.name}</h3>
      <p className="text-sm text-gray-700 mb-1">{member.email}</p>
      {member.slack_username && (
        <p className="text-sm text-gray-600 mb-2">@{member.slack_username}</p>
      )}
      {member.location_id && (
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium">Location:</span> {member.location_id.name}
        </p>
      )}
      {member.team_id && (
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">Team:</span> {member.team_id.name}
        </p>
      )}
      <span
        className={`inline-block px-2 py-1 text-xs rounded ${
          member.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {member.is_active ? 'Active' : 'Inactive'}
      </span>
    </div>
  );
}

interface Location {
  _id: string;
  name: string;
}

interface Team {
  _id: string;
  name: string;
  location_id?: string | { _id: string };
}

export default function MemberList() {
  const [members, setMembers] = useState<Member[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', location_id: '', team_id: '', slack_username: '' });

  const loadMembers = () => {
    fetch('/api/members')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMembers(data.data);
        } else {
          setError(data.error || 'Failed to load members');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMembers();
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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          roles: [{ role: 'kitchen_staff', scope: 'team' }],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFormData({ name: '', email: '', location_id: '', team_id: '', slack_username: '' });
        setShowForm(false);
        loadMembers();
      } else {
        setError(data.error || 'Failed to create member');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredTeams = formData.location_id
    ? teams.filter((t) => {
        const teamLocId = typeof t.location_id === 'object' ? t.location_id._id : t.location_id;
        return teamLocId === formData.location_id;
      })
    : teams;

  if (loading) {
    return <div className="p-4 text-gray-700">Loading members...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Members ({members.length})</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Create Member'}
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-white border rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded text-gray-900"
          />
          <input
            type="email"
            placeholder="Email *"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded text-gray-900"
          />
          <input
            type="text"
            placeholder="Slack Username (optional)"
            value={formData.slack_username}
            onChange={(e) => setFormData({ ...formData, slack_username: e.target.value })}
            className="w-full px-3 py-2 border rounded text-gray-900"
          />
          <select
            value={formData.location_id}
            onChange={(e) => {
              setFormData({ ...formData, location_id: e.target.value, team_id: '' });
            }}
            className="w-full px-3 py-2 border rounded text-gray-900"
          >
            <option value="">Select Location (optional)</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select
            value={formData.team_id}
            onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
            disabled={!formData.location_id}
            className="w-full px-3 py-2 border rounded text-gray-900 disabled:bg-gray-100"
          >
            <option value="">Select Team (optional)</option>
            {filteredTeams.map((team) => (
              <option key={team._id} value={team._id}>
                {team.name}
              </option>
            ))}
          </select>
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Create Member
          </button>
        </form>
      )}

      {members.length === 0 ? (
        <p className="text-gray-600">No members found. Create one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <MemberCard key={member._id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
