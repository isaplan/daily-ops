/**
 * @registry-id: DecisionFormComponent
 * @created: 2026-01-16T22:30:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Decision form component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Initial implementation with ConnectionPicker integration
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useDecisionViewModel.ts => Decision ViewModel
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/lib/viewmodels/useTeamViewModel.ts => Team ViewModel
 *   - app/lib/viewmodels/useMemberViewModel.ts => Member ViewModel
 *   - app/components/ConnectionPicker.tsx => Connection picker for entity linking
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/DecisionList.tsx => Uses DecisionForm
 *   ✓ app/decisions/page.tsx => Uses DecisionForm
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDecisionViewModel } from '@/lib/viewmodels/useDecisionViewModel'
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
import ConnectionPicker from './ConnectionPicker'
import type { Decision } from '@/lib/services/decisionService'

interface DecisionFormProps {
  decision?: Decision
  onSave: () => void
  onCancel: () => void
}

export default function DecisionForm({ decision, onSave, onCancel }: DecisionFormProps) {
  const viewModel = useDecisionViewModel(decision)
  const locationViewModel = useLocationViewModel()
  const teamViewModel = useTeamViewModel()
  const memberViewModel = useMemberViewModel()
  
  const [formData, setFormData] = useState({
    title: decision?.title || '',
    description: decision?.description || '',
    decision: decision?.decision || '',
    status: (decision?.status || 'proposed') as Decision['status'],
    created_by: typeof decision?.created_by === 'object' ? decision.created_by._id : decision?.created_by || '',
    approved_by: typeof decision?.approved_by === 'object' ? decision.approved_by._id : decision?.approved_by || '',
    involved_members: decision?.involved_members?.map(m => typeof m === 'object' ? m._id : m) || [],
    location_id: typeof decision?.connected_to?.location_id === 'object' ? decision.connected_to.location_id._id : decision?.connected_to?.location_id || '',
    team_id: typeof decision?.connected_to?.team_id === 'object' ? decision.connected_to.team_id._id : decision?.connected_to?.team_id || '',
    member_id: typeof decision?.connected_to?.member_id === 'object' ? decision.connected_to.member_id._id : decision?.connected_to?.member_id || '',
  })

  useEffect(() => {
    locationViewModel.loadLocations()
    teamViewModel.loadTeams()
    memberViewModel.loadMembers()
  }, [])

  const filteredTeams = useMemo(() => {
    if (!formData.location_id) return teamViewModel.teams
    return teamViewModel.teams.filter((t) => {
      const teamLocId = typeof t.location_id === 'object' ? t.location_id._id : t.location_id
      return teamLocId === formData.location_id
    })
  }, [formData.location_id, teamViewModel.teams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (decision?._id) {
      await viewModel.updateDecision(decision._id, {
        title: formData.title,
        description: formData.description,
        decision: formData.decision,
        status: formData.status,
        created_by: formData.created_by || undefined,
        approved_by: formData.approved_by || undefined,
        involved_members: formData.involved_members,
        location_id: formData.location_id || undefined,
        team_id: formData.team_id || undefined,
        member_id: formData.member_id || undefined,
      })
    } else {
      await viewModel.createDecision({
        title: formData.title,
        description: formData.description,
        decision: formData.decision,
        status: formData.status,
        created_by: formData.created_by || undefined,
        approved_by: formData.approved_by || undefined,
        involved_members: formData.involved_members,
        location_id: formData.location_id || undefined,
        team_id: formData.team_id || undefined,
        member_id: formData.member_id || undefined,
      })
    }

    if (!viewModel.error) {
      onSave()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{decision ? 'Edit Decision' : 'Create Decision'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {viewModel.error && (
            <Alert variant="destructive">
              <AlertDescription>{viewModel.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="decision">Decision *</Label>
            <Textarea
              id="decision"
              value={formData.decision}
              onChange={(e) => setFormData({ ...formData, decision: e.target.value })}
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as Decision['status'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proposed">Proposed</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="implemented">Implemented</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Select
              value={formData.location_id}
              onValueChange={(value) => setFormData({ ...formData, location_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
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
              value={formData.team_id}
              onValueChange={(value) => setFormData({ ...formData, team_id: value })}
              disabled={!formData.location_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
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

          <div className="space-y-2">
            <Label htmlFor="approved_by">Approved By</Label>
            <Select
              value={formData.approved_by}
              onValueChange={(value) => setFormData({ ...formData, approved_by: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {memberViewModel.members.map((member) => (
                  <SelectItem key={member._id} value={member._id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ConnectionPicker for many-to-many relationships */}
          {decision?._id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">LINKED ENTITIES</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Link this decision to other entities (notes, todos, channels, events)
                </p>
              </CardHeader>
              <CardContent>
                <ConnectionPicker
                  entityType="decision"
                  entityId={decision._id}
                  allowedTargetTypes={['note', 'todo', 'channel', 'event']}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={viewModel.loading}>
              {viewModel.loading ? 'Saving...' : decision ? 'Update' : 'Create'}
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
