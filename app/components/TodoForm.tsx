/**
 * @registry-id: TodoFormComponent
 * @created: 2026-01-16T22:30:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Todo form component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Initial implementation with ConnectionPicker integration
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useTodoViewModel.ts => Todo ViewModel
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/lib/viewmodels/useTeamViewModel.ts => Team ViewModel
 *   - app/lib/viewmodels/useMemberViewModel.ts => Member ViewModel
 *   - app/components/ConnectionPicker.tsx => Connection picker for entity linking
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/TodoList.tsx => Uses TodoForm
 *   ✓ app/todos/page.tsx => Uses TodoForm
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTodoViewModel } from '@/lib/viewmodels/useTodoViewModel'
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
import type { Todo } from '@/lib/services/todoService'

interface TodoFormProps {
  todo?: Todo
  onSave: () => void
  onCancel: () => void
}

export default function TodoForm({ todo, onSave, onCancel }: TodoFormProps) {
  const viewModel = useTodoViewModel()
  const locationViewModel = useLocationViewModel()
  const teamViewModel = useTeamViewModel()
  const memberViewModel = useMemberViewModel()
  
  const [formData, setFormData] = useState({
    title: todo?.title || '',
    description: todo?.description || '',
    status: (todo?.status || 'pending') as 'pending' | 'in_progress' | 'completed',
    priority: (todo?.priority || 'medium') as 'low' | 'medium' | 'high',
    assigned_to: typeof todo?.assigned_to === 'object' ? todo.assigned_to._id : todo?.assigned_to || '',
    location_id: typeof todo?.connected_to?.location_id === 'object' ? todo.connected_to.location_id._id : todo?.connected_to?.location_id || '',
    team_id: typeof todo?.connected_to?.team_id === 'object' ? todo.connected_to.team_id._id : todo?.connected_to?.team_id || '',
    member_id: typeof todo?.connected_to?.member_id === 'object' ? todo.connected_to.member_id._id : todo?.connected_to?.member_id || '',
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

    if (todo?._id) {
      await viewModel.updateTodo(todo._id, {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assigned_to || undefined,
        location_id: formData.location_id || undefined,
        team_id: formData.team_id || undefined,
        member_id: formData.member_id || undefined,
      })
    } else {
      await viewModel.createTodo({
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assigned_to || undefined,
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
        <CardTitle>{todo ? 'Edit Todo' : 'Create Todo'}</CardTitle>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as 'pending' | 'in_progress' | 'completed' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as 'low' | 'medium' | 'high' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <Label htmlFor="assigned_to">Assigned To</Label>
            <Select
              value={formData.assigned_to}
              onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
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
          {todo?._id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">LINKED ENTITIES</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Link this todo to other entities (notes, channels, events, decisions)
                </p>
              </CardHeader>
              <CardContent>
                <ConnectionPicker
                  entityType="todo"
                  entityId={todo._id}
                  allowedTargetTypes={['note', 'channel', 'event', 'decision']}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={viewModel.loading}>
              {viewModel.loading ? 'Saving...' : todo ? 'Update' : 'Create'}
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
