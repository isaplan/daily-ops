/**
 * @registry-id: EventListComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Event list component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Fixed TypeScript strict violation - replaced any with Event type
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useEventViewModel.ts => Event ViewModel
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/events/page.tsx => Uses EventList
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEventViewModel } from '@/lib/viewmodels/useEventViewModel'
import { useLocationViewModel } from '@/lib/viewmodels/useLocationViewModel'
import type { Event } from '@/lib/services/eventService'
import EventForm from './EventForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function EventList() {
  const router = useRouter()
  const viewModel = useEventViewModel()
  const locationViewModel = useLocationViewModel()
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [filter, setFilter] = useState({ location_id: '', status: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    viewModel.loadEvents(filter)
    locationViewModel.loadLocations()
  }, [filter])

  const handleDelete = async (id: string) => {
    await viewModel.deleteEvent(id)
    if (!viewModel.error) {
      setDeleteConfirm(null)
    }
  }

  const handleEdit = (event: Event) => {
    setEditingEvent(event)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingEvent(null)
    viewModel.loadEvents(filter)
  }

  const getStatusVariant = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'error'
      case 'in_progress':
        return 'warning'
      case 'confirmed':
        return 'info'
      default:
        return 'default'
    }
  }

  if (viewModel.loading && viewModel.events.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Events</h2>
        <Button onClick={() => setShowForm(true)}>+ Create Event</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Filter by Location</Label>
          <Select
            value={filter.location_id || 'all'}
            onValueChange={(value) => setFilter({ ...filter, location_id: value === 'all' ? '' : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locationViewModel.locations.map((loc) => (
                <SelectItem key={loc._id} value={loc._id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Filter by Status</Label>
          <Select
            value={filter.status || 'all'}
            onValueChange={(value) => setFilter({ ...filter, status: value === 'all' ? '' : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {viewModel.error && (
        <Alert variant="destructive">
          <AlertDescription>{viewModel.error}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <EventForm
          event={editingEvent}
          onSave={handleFormClose}
          onCancel={handleFormClose}
        />
      )}

      {viewModel.events.length === 0 ? (
        <EmptyState
          title="No events found"
          description="Create your first event to get started"
          action={{
            label: 'Create Event',
            onClick: () => setShowForm(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {viewModel.events.map((event) => (
            <Card
              key={event._id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{event.name}</CardTitle>
                  <StatusBadge status={getStatusVariant(event.status || 'planning')}>
                    {event.status}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1 mb-4">
                  <div>Client: {event.client_name}</div>
                  <div>Guests: {event.guest_count}</div>
                  <div>Date: {new Date(event.date).toLocaleDateString()}</div>
                  {event.location_id && (
                    <div>
                      📍{' '}
                      {typeof event.location_id === 'object'
                        ? event.location_id.name
                        : 'Location'}
                    </div>
                  )}
                  {event.assigned_to && (
                    <div className="mt-1">
                      <Badge variant="secondary">
                        👤 Assigned to:{' '}
                        {typeof event.assigned_to === 'object'
                          ? event.assigned_to.name
                          : 'Member'}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(event)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteConfirm({ id: event._id, name: event.name })}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
