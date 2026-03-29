/**
 * @registry-id: ChannelFormComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Channel form component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Fixed SelectItem empty string values to use 'none' instead
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useChannelViewModel.ts => Channel ViewModel
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/lib/viewmodels/useTeamViewModel.ts => Team ViewModel
 *   - app/lib/viewmodels/useMemberViewModel.ts => Member ViewModel
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/ChannelList.tsx => Uses ChannelForm
 */

'use client'

import { useEffect, useMemo } from 'react'
import { useChannelViewModel } from '@/lib/viewmodels/useChannelViewModel'
import { useLocationViewModel } from '@/lib/viewmodels/useLocationViewModel'
import { useTeamViewModel } from '@/lib/viewmodels/useTeamViewModel'
import { useMemberViewModel } from '@/lib/viewmodels/useMemberViewModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import type { Channel } from '@/lib/types/channel.types'

interface ChannelFormProps {
  channel?: Channel
  onSave: () => void
  onCancel: () => void
}

export default function ChannelForm({ channel, onSave, onCancel }: ChannelFormProps) {
  const viewModel = useChannelViewModel(channel)
  const locationViewModel = useLocationViewModel()
  const teamViewModel = useTeamViewModel()
  const memberViewModel = useMemberViewModel()

  useEffect(() => {
    locationViewModel.loadLocations()
    teamViewModel.loadTeams()
    memberViewModel.loadMembers()
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
    
    if (channel?._id) {
      await viewModel.updateChannel(channel._id, {
        name: viewModel.formData.name,
        description: viewModel.formData.description || undefined,
        type: viewModel.formData.type,
        location_id: viewModel.formData.location_id || undefined,
        team_id: viewModel.formData.team_id || undefined,
        member_id: viewModel.formData.member_id || undefined,
        members: viewModel.formData.members,
      })
    } else {
      await viewModel.createChannel({
        name: viewModel.formData.name,
        description: viewModel.formData.description || undefined,
        type: viewModel.formData.type,
        location_id: viewModel.formData.location_id || undefined,
        team_id: viewModel.formData.team_id || undefined,
        member_id: viewModel.formData.member_id || undefined,
        members: viewModel.formData.members,
      })
    }
    
    if (!viewModel.error) {
      onSave()
    }
  }

  const toggleMember = (memberId: string) => {
    const currentMembers = viewModel.formData.members
    if (currentMembers.includes(memberId)) {
      viewModel.setFormData({
        members: currentMembers.filter((id) => id !== memberId),
      })
    } else {
      viewModel.setFormData({
        members: [...currentMembers, memberId],
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{channel ? 'Update Channel' : 'Create Channel'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Channel Name *</Label>
            <Input
              id="name"
              placeholder="Channel Name (e.g., general, keuken)"
              value={viewModel.formData.name}
              onChange={(e) => viewModel.setFormData({ name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Description (optional)"
              value={viewModel.formData.description}
              onChange={(e) => viewModel.setFormData({ description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select
              value={viewModel.formData.type}
              onValueChange={(value) => viewModel.setFormData({ type: value })}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select
                value={viewModel.formData.location_id || 'none'}
                onValueChange={(value) =>
                  viewModel.setFormData({ location_id: value === 'none' ? '' : value, team_id: '' })
                }
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select Location (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
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
                value={viewModel.formData.team_id || 'none'}
                onValueChange={(value) => viewModel.setFormData({ team_id: value === 'none' ? '' : value })}
                disabled={!viewModel.formData.location_id}
              >
                <SelectTrigger id="team">
                  <SelectValue placeholder="Select Team (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {filteredTeams.map((team) => (
                    <SelectItem key={team._id} value={team._id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="member">Member</Label>
              <Select
                value={viewModel.formData.member_id || 'none'}
                onValueChange={(value) => viewModel.setFormData({ member_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger id="member">
                  <SelectValue placeholder="Select Member (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {memberViewModel.members.map((member) => (
                    <SelectItem key={member._id} value={member._id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Add Members</Label>
            <div className="max-h-48 overflow-y-auto border rounded p-3 bg-muted/50">
              {memberViewModel.members.map((member) => (
                <label
                  key={member._id}
                  className="flex items-center gap-2 py-1 cursor-pointer"
                >
                  <Checkbox
                    checked={viewModel.formData.members.includes(member._id)}
                    onCheckedChange={() => toggleMember(member._id)}
                  />
                  <span className="text-sm">{member.name}</span>
                </label>
              ))}
            </div>
          </div>

          {viewModel.error && (
            <Alert variant="destructive">
              <AlertDescription>{viewModel.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={viewModel.loading}>
              {viewModel.loading
                ? 'Saving...'
                : channel
                  ? 'Update Channel'
                  : 'Create Channel'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
