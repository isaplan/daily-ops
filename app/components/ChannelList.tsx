'use client';

import { useEffect, useState } from 'react';
import ChannelForm from './ChannelForm';
import { useRouter } from 'next/navigation';

interface Channel {
  _id: string;
  name: string;
  description?: string;
  type: string;
  members?: Array<{ _id: string; name: string }>;
  created_by?: { name: string };
  created_at: string;
}

export default function ChannelList() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  const loadChannels = () => {
    setLoading(true);
    fetch('/api/channels')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setChannels(data.data);
        } else {
          setError(data.error || 'Failed to load channels');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadChannels();
  }, []);

  if (loading && channels.length === 0) {
    return <div className="text-center py-8 text-gray-500">Loading channels...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Channels</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Create Channel
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}

      {showForm && (
        <ChannelForm
          onSave={() => {
            setShowForm(false);
            loadChannels();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {channels.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No channels found. Create your first channel!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((channel) => (
            <div
              key={channel._id}
              className="p-4 bg-white border rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-shadow"
              onClick={() => router.push(`/channels/${channel._id}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg text-gray-900">#{channel.name}</h3>
                <span className="px-2 py-1 text-xs bg-gray-100 rounded">{channel.type}</span>
              </div>
              {channel.description && (
                <p className="text-sm text-gray-600 mb-2">{channel.description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{channel.members?.length || 0} members</span>
                {channel.created_by && (
                  <span>
                    • Created by{' '}
                    <a
                      href={`/members/${channel.created_by._id || channel.created_by}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/members/${channel.created_by._id || channel.created_by}`;
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {channel.created_by.name}
                    </a>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
