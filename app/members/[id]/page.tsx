'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConnectionsDisplay from '@/components/ConnectionsDisplay';

function MemberDetailContent() {
  const params = useParams();
  const router = useRouter();
  const memberId = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) return;
    
    fetch(`/api/members/${memberId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMember(data.data);
        }
        setLoading(false);
      });
  }, [memberId]);

  if (loading) {
    return <div className="min-h-screen p-8 bg-gray-50">Loading member...</div>;
  }

  if (!member) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-600">Member not found</p>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{member.name}</h1>
            <div className="space-y-1 text-gray-600">
              {member.email && <div>📧 {member.email}</div>}
              {member.slack_username && <div>💬 Slack: {member.slack_username}</div>}
            </div>
          </div>

          {member.location_id && (
            <div className="mb-2">
              <span className="text-sm text-gray-600">Location: </span>
              <a
                href={`/locations/${member.location_id._id || member.location_id}`}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/locations/${member.location_id._id || member.location_id}`);
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                {member.location_id.name}
              </a>
            </div>
          )}

          {member.team_id && (
            <div className="mb-2">
              <span className="text-sm text-gray-600">Team: </span>
              <a
                href={`/teams/${member.team_id._id || member.team_id}`}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/teams/${member.team_id._id || member.team_id}`);
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                {member.team_id.name}
              </a>
            </div>
          )}

          {member.roles && member.roles.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-900 mb-2">Roles</h3>
              <div className="flex flex-wrap gap-2">
                {member.roles.map((role: any, idx: number) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded"
                  >
                    {role.role} ({role.scope})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Connections</h2>
          <ConnectionsDisplay type="member" id={memberId} />
        </div>
      </div>
    </div>
  );
}

export default function MemberDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <MemberDetailContent />
    </Suspense>
  );
}
