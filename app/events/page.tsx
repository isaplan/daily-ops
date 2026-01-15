'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import EventList from '../components/EventList'
import EventForm from '../components/EventForm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { eventService } from '@/lib/services/eventService'
import type { Event } from '@/lib/services/eventService'

function EventsContent() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const eventId = searchParams.get('event')
    if (eventId) {
      setLoading(true)
      eventService
        .getById(eventId)
        .then((response) => {
          if (response.success && response.data) {
            setSelectedEvent(response.data)
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      setSelectedEvent(null)
    }
  }, [searchParams])

  const handleBack = () => {
    const returnTo = searchParams.get('returnTo')
    if (returnTo) {
      router.push(returnTo)
    } else {
      setSelectedEvent(null)
      router.push('/events')
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Events</h1>
          <p className="text-muted-foreground">Create and manage events</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : selectedEvent ? (
          <div>
            <Button variant="outline" onClick={handleBack} className="mb-4">
              ← Back
            </Button>
            <EventForm
              event={selectedEvent}
              onSave={handleBack}
              onCancel={handleBack}
            />
          </div>
        ) : (
          <EventList />
        )}
      </div>
    </div>
  )
}

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <Skeleton className="h-12 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <EventsContent />
    </Suspense>
  )
}
