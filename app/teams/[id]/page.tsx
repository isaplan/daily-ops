'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConnectionsDisplay from '@/components/ConnectionsDisplay';
import type { ITeam } from '@/models/Team';

function TeamDetailContent() {
  const params = useParams();
  const router = useRouter();
  const teamId = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  
  const [team, setTeam] = useState<ITeam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    
    fetch(`/api/teams/${teamId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTeam(data.data);
        }
        setLoading(false);
      });
  }, [teamId]);

  if (loading) {
    return <div className="min-h-screen p-8 bg-gray-50">Loading team...</div>;
  }

  if (!team) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-600">Team not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 text-blue-600 hover:text-blue-800"
        >
          ← Back
        </button>
        
        <div className="bg-white border rounded-lg p-6 mb-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{team.name}</h1>
            {team.description && (
              <p className="text-gray-600">{team.description}</p>
            )}
          </div>

          {team.location_id && (
            <div className="mb-2">
              <span className="text-sm text-gray-600">Location: </span>
              <a
                href={`/locations/${team.location_id._id || team.location_id}`}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/locations/${team.location_id._id || team.location_id}`);
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                {team.location_id.name}
              </a>
            </div>
          )}

          <div className="mt-4">
            <span className={`px-2 py-1 text-xs rounded ${
              team.is_active
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {team.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Connections</h2>
          <ConnectionsDisplay type="team" id={teamId} />
        </div>
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <TeamDetailContent />
    </Suspense>
  );
}
