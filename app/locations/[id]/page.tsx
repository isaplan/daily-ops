'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConnectionsDisplay from '@/components/ConnectionsDisplay';
import type { ILocation } from '@/models/Location';

function LocationDetailContent() {
  const params = useParams();
  const router = useRouter();
  const locationId = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  
  const [location, setLocation] = useState<ILocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    
    fetch(`/api/locations/${locationId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLocation(data.data);
        }
        setLoading(false);
      });
  }, [locationId]);

  if (loading) {
    return <div className="min-h-screen p-8 bg-gray-50">Loading location...</div>;
  }

  if (!location) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-600">Location not found</p>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{location.name}</h1>
            {(location.address || location.city || location.country) && (
              <div className="space-y-1 text-gray-600">
                {location.address && <div>📍 {location.address}</div>}
                {(location.city || location.country) && (
                  <div>{location.city}{location.city && location.country ? ', ' : ''}{location.country}</div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            <span className={`px-2 py-1 text-xs rounded ${
              location.is_active
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {location.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Connections</h2>
          <ConnectionsDisplay type="location" id={locationId} />
        </div>
      </div>
    </div>
  );
}

export default function LocationDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <LocationDetailContent />
    </Suspense>
  );
}
