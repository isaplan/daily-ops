'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Location {
  _id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  is_active: boolean;
}

function LocationCard({ location }: { location: Location }) {
  const router = useRouter();
  
  return (
    <div 
      className="p-4 bg-white border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/locations/${location._id}`)}
    >
      <h3 className="font-semibold text-lg text-gray-900 mb-2">{location.name}</h3>
      {location.address && (
        <p className="text-sm text-gray-700 mb-1">{location.address}</p>
      )}
      {(location.city || location.country) && (
        <p className="text-sm text-gray-600 mb-2">
          {location.city}
          {location.city && location.country && ', '}
          {location.country}
        </p>
      )}
      <span
        className={`inline-block px-2 py-1 text-xs rounded ${
          location.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {location.is_active ? 'Active' : 'Inactive'}
      </span>
    </div>
  );
}

export default function LocationList() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', city: '', country: '' });

  const loadLocations = () => {
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLocations(data.data);
        } else {
          setError(data.error || 'Failed to load locations');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setFormData({ name: '', address: '', city: '', country: '' });
        setShowForm(false);
        loadLocations();
      } else {
        setError(data.error || 'Failed to create location');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-700">Loading locations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Locations ({locations.length})</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Create Location'}
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-white border rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Location Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded text-gray-900"
          />
          <input
            type="text"
            placeholder="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-3 py-2 border rounded text-gray-900"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="px-3 py-2 border rounded text-gray-900"
            />
            <input
              type="text"
              placeholder="Country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="px-3 py-2 border rounded text-gray-900"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Create Location
          </button>
        </form>
      )}

      {locations.length === 0 ? (
        <p className="text-gray-600">No locations found. Create one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((location) => (
            <LocationCard key={location._id} location={location} />
          ))}
        </div>
      )}
    </div>
  );
}
