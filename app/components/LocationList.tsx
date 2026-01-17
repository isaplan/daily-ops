/**
 * @registry-id: LocationListComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Location list component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Refactored to use useLocationViewModel + microcomponents
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/lib/services/locationService.ts => Location service (for create)
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/locations/** => Uses LocationList
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocationViewModel } from '@/lib/viewmodels/useLocationViewModel'
import { locationService } from '@/lib/services/locationService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'

import type { Location } from '@/lib/types/location.types'

function LocationCard({ location }: { location: Location }) {
  const router = useRouter()

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/locations/${location._id}`)}
    >
      <CardHeader>
        <CardTitle>{location.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {location.address && (
          <p className="text-sm text-muted-foreground mb-1">{location.address}</p>
        )}
        {(location.city || location.country) && (
          <p className="text-sm text-muted-foreground mb-2">
            {location.city}
            {location.city && location.country && ', '}
            {location.country}
          </p>
        )}
        <StatusBadge status={location.is_active !== false ? 'success' : 'default'}>
          {location.is_active !== false ? 'Active' : 'Inactive'}
        </StatusBadge>
      </CardContent>
    </Card>
  )
}

export default function LocationList() {
  const router = useRouter()
  const viewModel = useLocationViewModel()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', address: '', city: '', country: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    viewModel.loadLocations()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await locationService.create({
        name: formData.name,
        address: formData.address || undefined,
      })
      if (response.success) {
        setFormData({ name: '', address: '', city: '', country: '' })
        setShowForm(false)
        viewModel.loadLocations()
      } else {
        setError(response.error || 'Failed to create location')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create location')
    } finally {
      setLoading(false)
    }
  }

  if (viewModel.loading && viewModel.locations.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Locations ({viewModel.locations.length})</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Location'}
        </Button>
      </div>

      {(error || viewModel.error) && (
        <Alert variant="destructive">
          <AlertDescription>{error || viewModel.error}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Location</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Location Name *</Label>
                <Input
                  id="name"
                  placeholder="Location Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="Country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading}>
                Create Location
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {viewModel.locations.length === 0 ? (
        <EmptyState
          title="No locations found"
          description="Create one above to get started"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {viewModel.locations.map((location) => (
            <LocationCard key={location._id} location={location} />
          ))}
        </div>
      )}
    </div>
  )
}
