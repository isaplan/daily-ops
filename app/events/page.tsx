'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import EventList from '../components/EventList';
import EventForm from '../components/EventForm';

function EventsContent() {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const eventId = searchParams.get('event');
    if (eventId) {
      fetch(`/api/events/${eventId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSelectedEvent(data.data);
          }
        });
    } else {
      setSelectedEvent(null);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Events</h1>
          <p className="text-gray-700">Create and manage events</p>
        </div>
        
        {selectedEvent ? (
          <div>
            <button
              onClick={() => {
                const returnTo = searchParams.get('returnTo');
                if (returnTo) {
                  router.push(returnTo);
                } else {
                  setSelectedEvent(null);
                  router.push('/events');
                }
              }}
              className="mb-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2"
            >
              <span>←</span> Back
            </button>
            <EventForm
              event={selectedEvent}
              onSave={() => {
                const returnTo = searchParams.get('returnTo');
                if (returnTo) {
                  router.push(returnTo);
                } else {
                  setSelectedEvent(null);
                  router.push('/events');
                }
              }}
              onCancel={() => {
                const returnTo = searchParams.get('returnTo');
                if (returnTo) {
                  router.push(returnTo);
                } else {
                  setSelectedEvent(null);
                  router.push('/events');
                }
              }}
            />
          </div>
        ) : (
          <EventList />
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <EventsContent />
    </Suspense>
  );
}
