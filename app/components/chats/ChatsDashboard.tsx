/**
 * @registry-id: ChatsDashboard
 * @created: 2026-01-16T16:00:00.000Z
 * @last-modified: 2026-01-16T16:00:00.000Z
 * @description: Chats dashboard component using MVVM pattern and shadcn microcomponents
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Chats interface
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useChatsViewModel.ts => Chats ViewModel
 *   - app/components/ui/** => Shadcn microcomponents only
 * 
 * @exports-to:
 *   ✓ app/(authenticated)/chats/page.tsx => Uses ChatsDashboard
 */

'use client'

import { useEffect } from 'react'
import { useChatsViewModel } from '@/lib/viewmodels/useChatsViewModel'
import ChannelSidebar from './ChannelSidebar'
import MessageThread from './MessageThread'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ChatsDashboard() {
  const { channels, activeChannel, messages, loading, error, loadChannels, setActiveChannel } =
    useChatsViewModel()

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  if (error && channels.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex h-full">
      <ChannelSidebar
        channels={channels}
        activeChannelId={activeChannel?._id || null}
        onSelectChannel={setActiveChannel}
        loading={loading}
      />
      <div className="flex-1 flex flex-col">
        {activeChannel ? (
          <MessageThread channel={activeChannel} messages={messages} loading={loading} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <p>Select a channel to start chatting</p>
          </div>
        )}
      </div>
    </div>
  )
}
