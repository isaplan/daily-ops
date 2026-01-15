/**
 * @registry-id: TeamListComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Team list component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Refactored to use useTeamViewModel + microcomponents
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useTeamViewModel.ts => Team ViewModel
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/teams/** => Uses TeamList
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTeamViewModel } from '@/lib/viewmodels/useTeamViewModel'
import { useLocationViewModel } from '@/lib/viewmodels/useLocationViewModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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

function TeamCard({ team }: { team: any }) {
  const router = useRouter()

  const handleLocationClick = (e: React.MouseEvent, locationId: string) => {
    e.stopPropagation()
    router.push(`/locations/${locationId}`)
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/teams/${team._id}`)}
    >
      <CardHeader>
        <CardTitle>{team.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {team.description && (
          <p className="text-sm text-muted-foreground mb-2">{team.description}</p>
        )}
        {team.location_id && typeof team.location_id === 'object' && (
          <p className="text-sm mb-2">
            <span className="font-medium">Location:</span>{' '}
            <button
              onClick={(e) => handleLocationClick(e, team.location_id._id)}
              className="text-blue-600 hover:text-blue-800"
            >
              {team.location_id.name}
            </button>
          </p>
        )}
        <StatusBadge status={team.is_active ? 'success' : 'default'}>
          {team.is_active ? 'Active' : 'Inactive'}
        </StatusBadge>
      </CardContent>
    </Card>
  )
}

export default function TeamList() {
  const router = useRouter()
  const viewModel = useTeamViewModel()
  const locationViewModel = useLocationViewModel()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    viewModel.loadTeams()
    locationViewModel.loadLocations()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!viewModel.formData.location_id) {
      return
    }
    await viewModel.createTeam({
      name: viewModel.formData.name,
      description: viewModel.formData.description || undefined,
      location_id: viewModel.formData.location_id,
    })
    if (!viewModel.error) {
      setShowForm(false)
    }
  }

  if (viewModel.loading && viewModel.teams.length === 0) {
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Teams ({viewModel.teams.length})</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Team'}
        </Button>
      </div>

      {viewModel.error && (
        <Alert variant="destructive">
          <AlertDescription>{viewModel.error}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Team</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Team Name *</Label>
                <Input
                  id="name"
                  placeholder="Team Name"
                  value={viewModel.formData.name}
                  onChange={(e) => viewModel.setFormData({ name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Description"
                  value={viewModel.formData.description}
                  onChange={(e) => viewModel.setFormData({ description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Select
                  value={viewModel.formData.location_id}
                  onValueChange={(value) => viewModel.setFormData({ location_id: value })}
                  required
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationViewModel.locations.map((loc) => (
                      <SelectItem key={loc._id} value={loc._id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={viewModel.loading}>
                Create Team
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {viewModel.teams.length === 0 ? (
        <EmptyState
          title="No teams found"
          description="Create one above to get started"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {viewModel.teams.map((team) => (
            <TeamCard key={team._id} team={team} />
          ))}
        </div>
      )}
    </div>
  )
}
