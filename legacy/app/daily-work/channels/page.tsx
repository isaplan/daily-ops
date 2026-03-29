/**
 * @registry-id: ChannelsPage
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Channels index page (migrated to /daily-work/channels)
 * @last-fix: [2026-01-24] Updated route location and imports
 */

'use client';

import { Suspense } from 'react';
import ChannelList from '@/components/ChannelList';

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

