'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IEvent } from '@/models/Event';

export default function Home() {
  const [assignedEvents, setAssignedEvents] = useState<IEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // For POC, we'll use the first member as the current user
    // In production, this would come from auth context
    fetch('/api/members')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        return res.json();
      })
      .then((data) => {
        if (data.success && data.data.length > 0) {
          const currentUserId = data.data[0]._id;
          return fetch(`/api/events?assigned_to=${currentUserId}`);
        }
        setLoading(false);
        return null;
      })
      .then(async (res) => {
        if (!res) return;
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.success) {
          setAssignedEvents(data.data.filter((e: IEvent) => e.status === 'planning' || e.status === 'confirmed'));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading events:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Dashboard</h1>
          <p className="text-gray-700">Overview of your organization</p>
        </div>

        {assignedEvents.length > 0 && (
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-blue-900">📅 Events Assigned to You</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedEvents.map((event) => (
                <div
                  key={event._id}
                  className="p-4 bg-white border rounded-lg shadow-sm hover:shadow-md cursor-pointer"
                  onClick={() => router.push(`/events?event=${event._id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">{event.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${
                      event.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                      event.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {event.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Client: {event.client_name}</div>
                    <div>Date: {new Date(event.date).toLocaleDateString()}</div>
                    {event.location_id && (
                      <div>📍 {event.location_id.name}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white border rounded-lg shadow-sm">
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">Locations</h2>
            <p className="text-gray-600">Manage your locations</p>
          </div>
          <div className="p-6 bg-white border rounded-lg shadow-sm">
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">Teams</h2>
            <p className="text-gray-600">View and manage teams</p>
          </div>
          <div className="p-6 bg-white border rounded-lg shadow-sm">
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">Members</h2>
            <p className="text-gray-600">Your organization members</p>
          </div>
        </div>
      </div>
    </div>
  );
}
