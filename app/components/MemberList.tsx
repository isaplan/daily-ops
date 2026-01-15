/**
 * @registry-id: MemberListComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Member list component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Refactored to use useMemberViewModel + microcomponents
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useMemberViewModel.ts => Member ViewModel
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/lib/viewmodels/useTeamViewModel.ts => Team ViewModel
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/members/page.tsx => Uses MemberList
 */

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useMemberViewModel } from '@/lib/viewmodels/useMemberViewModel'
import { useLocationViewModel } from '@/lib/viewmodels/useLocationViewModel'
import { useTeamViewModel } from '@/lib/viewmodels/useTeamViewModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ConnectionSheet } from './ConnectionSheet'

function MemberCard({
  member,
  onOpenSheet,
}: {
  member: any
  onOpenSheet: (id: string, title: string) => void
}) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onOpenSheet(member._id, member.name)}
    >
      <CardHeader>
        <CardTitle>{member.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-1">{member.email}</p>
        {member.slack_username && (
          <p className="text-sm text-muted-foreground mb-2">@{member.slack_username}</p>
        )}
        {member.location_id && (
          <p className="text-sm mb-1">
            <span className="font-medium">Location:</span>{' '}
            {typeof member.location_id === 'object'
              ? member.location_id.name
              : member.location_id}
          </p>
        )}
        {member.team_id && (
          <p className="text-sm mb-2">
            <span className="font-medium">Team:</span>{' '}
            {typeof member.team_id === 'object' ? member.team_id.name : member.team_id}
          </p>
        )}
        <StatusBadge status={member.is_active ? 'success' : 'default'}>
          {member.is_active ? 'Active' : 'Inactive'}
        </StatusBadge>
      </CardContent>
    </Card>
  )
}

export default function MemberList() {
  const viewModel = useMemberViewModel()
  const locationViewModel = useLocationViewModel()
  const teamViewModel = useTeamViewModel()
  const [showForm, setShowForm] = useState(false)
  const [selectedMember, setSelectedMember] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    viewModel.loadMembers()
    locationViewModel.loadLocations()
    teamViewModel.loadTeams()
  }, [])

  const filteredTeams = useMemo(() => {
    if (!viewModel.formData.location_id) return teamViewModel.teams
    return teamViewModel.teams.filter((t) => {
      const teamLocId = typeof t.location_id === 'object' ? t.location_id._id : t.location_id
      return teamLocId === viewModel.formData.location_id
    })
  }, [viewModel.formData.location_id, teamViewModel.teams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await viewModel.createMember({
      ...viewModel.formData,
      roles: [{ role: 'kitchen_staff', scope: 'team' }],
    })
    if (!viewModel.error) {
      setShowForm(false)
    }
  }

  if (viewModel.loading && viewModel.members.length === 0) {
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
        <h2 className="text-2xl font-bold">Members ({viewModel.members.length})</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Member'}
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
            <CardTitle>Create Member</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={viewModel.formData.name}
                  onChange={(e) => viewModel.setFormData({ name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={viewModel.formData.email}
                  onChange={(e) => viewModel.setFormData({ email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slack_username">Slack Username</Label>
                <Input
                  id="slack_username"
                  value={viewModel.formData.slack_username}
                  onChange={(e) => viewModel.setFormData({ slack_username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select
                  value={viewModel.formData.location_id}
                  onValueChange={(value) =>
                    viewModel.setFormData({ location_id: value, team_id: '' })
                  }
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select Location (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {locationViewModel.locations.map((loc) => (
                      <SelectItem key={loc._id} value={loc._id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team">Team</Label>
                <Select
                  value={viewModel.formData.team_id}
                  onValueChange={(value) => viewModel.setFormData({ team_id: value })}
                  disabled={!viewModel.formData.location_id}
                >
                  <SelectTrigger id="team">
                    <SelectValue placeholder="Select Team (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {filteredTeams.map((team) => (
                      <SelectItem key={team._id} value={team._id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={viewModel.loading}>
                Create Member
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {viewModel.members.length === 0 ? (
        <EmptyState
          title="No members found"
          description="Create one above to get started"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {viewModel.members.map((member) => (
            <MemberCard
              key={member._id}
              member={member}
              onOpenSheet={(id, title) => setSelectedMember({ id, title })}
            />
          ))}
        </div>
      )}

      {selectedMember && (
        <Sheet open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{selectedMember.title}</SheetTitle>
            </SheetHeader>
            <ConnectionSheet
              entityType="member"
              entityId={selectedMember.id}
              entityTitle={selectedMember.title}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
