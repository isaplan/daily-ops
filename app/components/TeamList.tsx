'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Team {
  _id: string;
  name: string;
  description?: string;
  is_active: boolean;
  location_id?: string | { name: string; _id: string };
}

interface Location {
  _id: string;
  name: string;
}

function TeamCard({ team }: { team: Team }) {
  const router = useRouter();
  
  const handleLocationClick = (e: React.MouseEvent, locationId: string) => {
    e.stopPropagation();
    router.push(`/locations/${locationId}`);
  };
  
  return (
    <div 
      className="p-4 bg-white border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/teams/${team._id}`)}
    >
      <h3 className="font-semibold text-lg text-gray-900 mb-1">{team.name}</h3>
      {team.description && (
        <p className="text-sm text-gray-700 mb-2">{team.description}</p>
      )}
      {team.location_id && typeof team.location_id === 'object' && (
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">Location:</span>{' '}
          <a
            href={`/locations/${team.location_id._id}`}
            onClick={(e) => handleLocationClick(e, team.location_id._id)}
            className="text-blue-600 hover:text-blue-800"
          >
            {team.location_id.name}
          </a>
        </p>
      )}
      <span
        className={`inline-block px-2 py-1 text-xs rounded ${
          team.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {team.is_active ? 'Active' : 'Inactive'}
      </span>
    </div>
  );
}

export default function TeamList() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', location_id: '' });

  const loadTeams = () => {
    fetch('/api/teams')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTeams(data.data);
        } else {
          setError(data.error || 'Failed to load teams');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTeams();
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLocations(data.data);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location_id) {
      setError('Please select a location');
      return;
    }
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setFormData({ name: '', description: '', location_id: '' });
        setShowForm(false);
        loadTeams();
      } else {
        setError(data.error || 'Failed to create team');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete team');
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-700">Loading teams...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Teams ({teams.length})</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Create Team'}
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-white border rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Team Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded text-gray-900"
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded text-gray-900"
          />
          <select
            value={formData.location_id}
            onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded text-gray-900"
          >
            <option value="">Select Location *</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Create Team
          </button>
        </form>
      )}

      {teams.length === 0 ? (
        <p className="text-gray-600">No teams found. Create one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <TeamCard key={team._id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
