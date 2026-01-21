'use client'

import { useParams, usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { MembersSidebar } from '@/components/MembersSidebar'

interface Location {
  _id: string
  name: string
  address?: string
  city?: string
}

interface Channel {
  _id: string
  name: string
  description?: string
  type?: string
  members?: Array<{ _id: string; name: string }>
  connected_to?: {
    location_id?: Location | string
    team_id?: { _id: string; name: string } | string
    member_id?: { _id: string; name: string } | string
  }
}

interface Member {
  _id: string
  name: string
}

export function ChannelHeader() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const [channel, setChannel] = useState<Channel | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const channelId = params?.id as string | undefined
  const isChannelPage = pathname?.startsWith('/channels/') && channelId

  useEffect(() => {
    if (!isChannelPage || !channelId) {
      setChannel(null)
      return
    }

    setLoading(true)
    fetch(`/api/channels/${channelId}`)
      .then(async (res) => {
        if (!res.ok) return null
        const data = await res.json()
        return data.success ? data.data : null
      })
      .then((data) => {
        setChannel(data)
        if (data?.members) {
          setMembers(data.members)
        }
      })
      .catch(() => {
        setChannel(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [channelId, isChannelPage])

  useEffect(() => {
    if (sheetOpen && channelId) {
      // Reload members when sheet opens
      fetch(`/api/channels/${channelId}`)
        .then(async (res) => {
          if (!res.ok) return null
          const data = await res.json()
          return data.success ? data.data : null
        })
        .then((data) => {
          if (data?.members) {
            setMembers(data.members)
          }
        })
        .catch(() => {})
    }
    
    // Add/remove class to body to adjust layout
    if (sheetOpen) {
      document.body.setAttribute('data-members-panel-open', 'true')
    } else {
      document.body.removeAttribute('data-members-panel-open')
    }
    
    return () => {
      document.body.removeAttribute('data-members-panel-open')
    }
  }, [sheetOpen, channelId])

  if (!isChannelPage || !channel) {
    return null
  }

  const membersCount = members.length || channel.members?.length || 0
  const location = channel.connected_to?.location_id
  const locationId = typeof location === 'object' ? location._id : location
  const locationName = typeof location === 'object' ? location.name : null

  return (
    <>
      <div className="flex items-center gap-3 flex-1">
        <div>
          <h1 className="text-lg font-semibold text-foreground">#{channel.name}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {channel.description && (
              <p className="text-xs text-muted-foreground">{channel.description}</p>
            )}
            {locationId && (
              <button
                onClick={() => locationId && router.push(`/locations/${locationId}`)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <span>📍</span>
                <span className="underline">{locationName || 'View Location'}</span>
              </button>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          <Button
            onClick={() => setSheetOpen(!sheetOpen)}
            variant="secondary"
            size="sm"
          >
            {membersCount} members
          </Button>
          {channel.type && (
            <Button variant="secondary" size="sm" disabled>
              {channel.type} channel
            </Button>
          )}
        </div>
      </div>

      {/* Members Sidebar - Sheet overlay */}
      <MembersSidebar
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        members={members}
        membersCount={membersCount}
      />
    </>
  )
}
