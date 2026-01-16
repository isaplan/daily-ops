/**
 * @registry-id: NoteFormComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Note form component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Fixed SelectItem empty string values to use 'none' instead
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useNoteViewModel.ts => Note ViewModel
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/lib/viewmodels/useTeamViewModel.ts => Team ViewModel
 *   - app/lib/viewmodels/useMemberViewModel.ts => Member ViewModel
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/NoteList.tsx => Uses NoteForm
 */

'use client'

import { useEffect, useMemo } from 'react'
import { useNoteViewModel } from '@/lib/viewmodels/useNoteViewModel'
import { useLocationViewModel } from '@/lib/viewmodels/useLocationViewModel'
import { useTeamViewModel } from '@/lib/viewmodels/useTeamViewModel'
import { useMemberViewModel } from '@/lib/viewmodels/useMemberViewModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Note } from '@/lib/types/note.types'

interface NoteFormProps {
  note?: Note
  onSave: () => void
  onCancel: () => void
}

export default function NoteForm({ note, onSave, onCancel }: NoteFormProps) {
  const viewModel = useNoteViewModel(note)
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
    
    const tagsArray = viewModel.formData.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    if (note?._id) {
      await viewModel.updateNote(note._id, {
        title: viewModel.formData.title,
        content: viewModel.formData.content,
        location_id: viewModel.formData.location_id || undefined,
        team_id: viewModel.formData.team_id || undefined,
        member_id: viewModel.formData.member_id || undefined,
        tags: tagsArray,
        is_pinned: viewModel.formData.is_pinned,
      })
    } else {
      await viewModel.createNote({
        title: viewModel.formData.title,
        content: viewModel.formData.content,
        location_id: viewModel.formData.location_id || undefined,
        team_id: viewModel.formData.team_id || undefined,
        member_id: viewModel.formData.member_id || undefined,
        tags: tagsArray,
        is_pinned: viewModel.formData.is_pinned,
      })
    }
    
    if (!viewModel.error) {
      onSave()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{note ? 'Update Note' : 'Create Note'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Note Title *</Label>
            <Input
              id="title"
              placeholder="Note Title"
              value={viewModel.formData.title}
              onChange={(e) => viewModel.setFormData({ title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Note Content *</Label>
            <Textarea
              id="content"
              placeholder="Note Content"
              value={viewModel.formData.content}
              onChange={(e) => viewModel.setFormData({ content: e.target.value })}
              required
              rows={8}
            />
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
                  <SelectValue placeholder="Select Location" />
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
                  <SelectValue placeholder="Select Team" />
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
                  <SelectValue placeholder="Select Member" />
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
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              placeholder="tag1, tag2, tag3"
              value={viewModel.formData.tags}
              onChange={(e) => viewModel.setFormData({ tags: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_pinned"
              checked={viewModel.formData.is_pinned}
              onCheckedChange={(checked) =>
                viewModel.setFormData({ is_pinned: checked === true })
              }
            />
            <Label htmlFor="is_pinned" className="cursor-pointer">
              Pin this note
            </Label>
          </div>

          {viewModel.error && (
            <Alert variant="destructive">
              <AlertDescription>{viewModel.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={viewModel.loading}>
              {viewModel.loading ? 'Saving...' : 'Save Note'}
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
