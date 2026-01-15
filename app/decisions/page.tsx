'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { IDecision } from '@/models/Decision';

function DecisionsContent() {
  const [decisions, setDecisions] = useState<IDecision[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<IDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/decisions')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDecisions(data.data);
          const decisionId = searchParams.get('decision');
          if (decisionId) {
            const decision = data.data.find((d: IDecision) => d._id.toString() === decisionId);
            if (decision) setSelectedDecision(decision);
          }
        }
        setLoading(false);
      });
  }, [searchParams]);

  if (loading) {
    return <div className="min-h-screen p-8 bg-gray-50">Loading...</div>;
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => {
              const returnTo = searchParams.get('returnTo');
              if (returnTo) {
                router.push(returnTo);
              } else {
                router.back();
              }
            }}
            className="mb-4 text-blue-600 hover:text-blue-800"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Decisions</h1>
          <p className="text-gray-700">View and manage decisions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {selectedDecision ? (
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">{selectedDecision.title}</h2>
                <p className="text-gray-700 mb-4">{selectedDecision.description}</p>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                  <p className="font-semibold text-blue-900">Decision:</p>
                  <p className="text-blue-800">{selectedDecision.decision}</p>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    <span className={`px-2 py-1 text-xs rounded ${
                      selectedDecision.status === 'approved' ? 'bg-green-100 text-green-800' :
                      selectedDecision.status === 'implemented' ? 'bg-blue-100 text-blue-800' :
                      selectedDecision.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedDecision.status}
                    </span>
                  </div>
                  {selectedDecision.created_by && (
                    <div>
                      <span className="font-medium">Created by:</span> {selectedDecision.created_by.name}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {decisions.map((decision) => (
                  <div
                    key={decision._id}
                    className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md"
                    onClick={() => setSelectedDecision(decision)}
                  >
                    <h3 className="font-semibold text-lg">{decision.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{decision.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        decision.status === 'approved' ? 'bg-green-100 text-green-800' :
                        decision.status === 'implemented' ? 'bg-blue-100 text-blue-800' :
                        decision.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {decision.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DecisionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <DecisionsContent />
    </Suspense>
  );
}
