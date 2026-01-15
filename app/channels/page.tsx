'use client';

import { Suspense } from 'react';
import ChannelList from '../components/ChannelList';

function ChannelsContent() {
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Channels</h1>
          <p className="text-gray-700">Communication channels - Slack-like experience</p>
        </div>
        
        <ChannelList />
      </div>
    </div>
  );
}

export default function ChannelsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <ChannelsContent />
    </Suspense>
  );
}
