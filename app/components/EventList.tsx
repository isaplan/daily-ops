'use client';

import { useEffect, useState } from 'react';
import EventForm from './EventForm';

interface Event {
  _id: string;
  name: string;
  client_name: string;
  guest_count: number;
  date: string;
  location_id?: { _id: string; name: string };
  assigned_to?: { _id: string; name: string } | string;
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  created_by?: { name: string; email: string };
  created_at: string;
}

export default function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [filter, setFilter] = useState({ location_id: '', status: '' });

  const loadEvents = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.location_id) params.append('location_id', filter.location_id);
    if (filter.status) params.append('status', filter.status);

    fetch(`/api/events?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEvents(data.data);
        } else {
          setError(data.error || 'Failed to load events');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadEvents();
      } else {
        setError(data.error || 'Failed to delete event');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingEvent(null);
    loadEvents();
  };

  const [locations, setLocations] = useState<Array<{ _id: string; name: string }>>([]);

  useEffect(() => {
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLocations(data.data);
      });
  }, []);

  if (loading && events.length === 0) {
    return <div className="text-center py-8 text-gray-500">Loading events...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Events</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Create Event
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Location</label>
          <select
            value={filter.location_id}
            onChange={(e) => setFilter({ ...filter, location_id: e.target.value })}
            className="w-full px-3 py-2 border rounded bg-white text-gray-900"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="w-full px-3 py-2 border rounded bg-white text-gray-900"
          >
            <option value="">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}

      {showForm && (
        <EventForm
          event={editingEvent || undefined}
          onSave={handleFormClose}
          onCancel={handleFormClose}
        />
      )}

      {events.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No events found. Create your first event!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <div key={event._id} className="p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{event.name}</h3>
                <span className={`px-2 py-1 text-xs rounded ${
                  event.status === 'completed' ? 'bg-green-100 text-green-800' :
                  event.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                  event.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                  event.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {event.status}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 mb-2">
                <div>Client: {event.client_name}</div>
                <div>Guests: {event.guest_count}</div>
                <div>Date: {new Date(event.date).toLocaleDateString()}</div>
                {event.location_id && (
                  <div>
                    📍{' '}
                    <a
                      href={`/locations/${event.location_id._id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        window.location.href = `/locations/${event.location_id._id}`;
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {event.location_id.name}
                    </a>
                  </div>
                )}
                {event.assigned_to && (
                  <div className="mt-1">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                      👤 Assigned to:{' '}
                      <a
                        href={`/members/${typeof event.assigned_to === 'object' ? event.assigned_to._id : event.assigned_to}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          window.location.href = `/members/${typeof event.assigned_to === 'object' ? event.assigned_to._id : event.assigned_to}`;
                        }}
                        className="font-medium hover:underline"
                      >
                        {typeof event.assigned_to === 'object' ? event.assigned_to.name : 'Member'}
                      </a>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleEdit(event)}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(event._id)}
                  className="px-3 py-1 text-sm bg-red-200 text-red-700 rounded hover:bg-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
