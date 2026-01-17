/**
 * @registry-id: ChatsDashboard
 * @created: 2026-01-16T16:00:00.000Z
 * @last-modified: 2026-01-16T20:30:00.000Z
 * @description: Chats dashboard component using MVVM pattern and shadcn microcomponents
 * @last-fix: [2026-01-16] Removed ChannelSidebar, now uses URL params for channel selection
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
import { useSearchParams } from 'next/navigation'
import { useChatsViewModel } from '@/lib/viewmodels/useChatsViewModel'
import MessageThread from './MessageThread'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ChatsDashboard() {
  const searchParams = useSearchParams()
  const channelId = searchParams.get('channelId')
  const { channels, activeChannel, messages, loading, error, loadChannels, setActiveChannel } =
    useChatsViewModel()

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  useEffect(() => {
    if (channelId) {
      setActiveChannel(channelId)
    }
  }, [channelId, setActiveChannel])

  if (error && channels.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        {activeChannel ? (
          <MessageThread channel={activeChannel} messages={messages} loading={loading} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <p>Select a channel from the sidebar to start chatting</p>
          </div>
        )}
      </div>
    </div>
  )
}
