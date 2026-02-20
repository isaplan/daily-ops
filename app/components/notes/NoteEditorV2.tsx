/**
 * @registry-id: NoteEditorV2
 * @created: 2026-02-19T00:00:00.000Z
 * @last-modified: 2026-02-19T00:00:00.000Z
 * @description: V2 note editor - TipTap body + metadata in sidepanel
 * @last-fix: [2026-02-19] Initial implementation
 *
 * @exports-to:
 *   ✓ app/daily-work/notes/page.tsx => Shown when create=true (V2)
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNoteViewModel } from '@/lib/viewmodels/useNoteViewModel'
import { useLocationViewModel } from '@/lib/viewmodels/useLocationViewModel'
import { useTeamViewModel } from '@/lib/viewmodels/useTeamViewModel'
import { useMemberViewModel } from '@/lib/viewmodels/useMemberViewModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import ConnectionPicker from '@/components/ConnectionPicker'
import BlockBasedNoteEditor from '@/components/notes/BlockBasedNoteEditor'
import {
  type NoteBlock,
  createEmptyBlock,
  parseBlockNoteContent,
  serializeBlockNoteContent,
} from '@/lib/types/noteBlock.types'
import { getWeeklyTemplateBlocks, getWeeklyNoteTitle } from '@/lib/templates/weeklyNoteTemplate'
import type { Note } from '@/lib/types/note.types'

interface NoteEditorV2Props {
  note?: Note | null
  initialTemplate?: 'weekly'
  onSave: () => void
  onCancel: () => void
}

export default function NoteEditorV2({ note, initialTemplate, onSave, onCancel }: NoteEditorV2Props) {
  const viewModel = useNoteViewModel(note ?? undefined)
  const locationViewModel = useLocationViewModel()
  const teamViewModel = useTeamViewModel()
  const memberViewModel = useMemberViewModel()

  const [blocks, setBlocks] = useState<NoteBlock[]>(() => {
    if (!note && initialTemplate === 'weekly') return getWeeklyTemplateBlocks()
    const content = viewModel.formData.content
    const parsed = parseBlockNoteContent(content)
    if (parsed?.length) return parsed
    if (content?.trim() && !content.trim().startsWith('{')) {
      return [{ ...createEmptyBlock(), content }]
    }
    return [createEmptyBlock()]
  })

  useEffect(() => {
    if (note?.content) {
      const parsed = parseBlockNoteContent(note.content)
      if (parsed?.length) setBlocks(parsed)
      return
    }
    if (!note && initialTemplate === 'weekly') {
      setBlocks(getWeeklyTemplateBlocks())
      viewModel.setFormData({ title: getWeeklyNoteTitle() })
    }
  }, [note?._id, initialTemplate])

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
      .filter(Boolean)
    const content = serializeBlockNoteContent(blocks)

    let ok = false
    if (note?._id) {
      ok = await viewModel.updateNote(note._id, {
        title: viewModel.formData.title,
        content,
        location_id: viewModel.formData.location_id || undefined,
        team_id: viewModel.formData.team_id || undefined,
        member_id: viewModel.formData.member_id || undefined,
        tags: tagsArray,
        is_pinned: viewModel.formData.is_pinned,
      })
    } else {
      ok = await viewModel.createNote({
        title: viewModel.formData.title,
        content,
        location_id: viewModel.formData.location_id || undefined,
        team_id: viewModel.formData.team_id || undefined,
        member_id: viewModel.formData.member_id || undefined,
        tags: tagsArray,
        is_pinned: viewModel.formData.is_pinned,
      })
    }
    if (ok) onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-6">
      {/* Main: title + editor */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="note-title" className="text-muted-foreground text-sm">
            Title
          </Label>
          <Input
            id="note-title"
            placeholder="Note title"
            value={viewModel.formData.title}
            onChange={(e) => viewModel.setFormData({ title: e.target.value })}
            className="text-lg font-medium"
          />
        </div>
        <BlockBasedNoteEditor
          blocks={blocks}
          onChange={setBlocks}
          placeholder="Write your note… Use @todo … @Todo ends or /todo for tasks. Add blocks with the button below."
        />
        {viewModel.error && (
          <Alert variant="destructive">
            <AlertDescription>{viewModel.error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Sidepanel: metadata */}
      <aside className="w-72 shrink-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location" className="text-muted-foreground text-xs">
                Location
              </Label>
              <Select
                value={viewModel.formData.location_id || 'none'}
                onValueChange={(value) =>
                  viewModel.setFormData({ location_id: value === 'none' ? '' : value, team_id: '' })
                }
              >
                <SelectTrigger id="location" className="h-9">
                  <SelectValue placeholder="Select location" />
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
              <Label htmlFor="team" className="text-muted-foreground text-xs">
                Team
              </Label>
              <Select
                value={viewModel.formData.team_id || 'none'}
                onValueChange={(value) => viewModel.setFormData({ team_id: value === 'none' ? '' : value })}
                disabled={!viewModel.formData.location_id}
              >
                <SelectTrigger id="team" className="h-9">
                  <SelectValue placeholder="Select team" />
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
              <Label htmlFor="member" className="text-muted-foreground text-xs">
                Member
              </Label>
              <Select
                value={viewModel.formData.member_id || 'none'}
                onValueChange={(value) => viewModel.setFormData({ member_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger id="member" className="h-9">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {memberViewModel.members.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags" className="text-muted-foreground text-xs">
                Tags
              </Label>
              <Input
                id="tags"
                placeholder="tag1, tag2"
                value={viewModel.formData.tags}
                onChange={(e) => viewModel.setFormData({ tags: e.target.value })}
                className="h-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is_pinned"
                checked={viewModel.formData.is_pinned}
                onCheckedChange={(checked) => viewModel.setFormData({ is_pinned: checked === true })}
              />
              <Label htmlFor="is_pinned" className="cursor-pointer text-sm">
                Pin note
              </Label>
            </div>

            {note?._id && (
              <div className="border-t pt-3">
                <Label className="text-muted-foreground text-xs">Connections</Label>
                <div className="mt-2">
                  <ConnectionPicker
                    entityType="note"
                    entityId={note._id}
                    allowedTargetTypes={['todo', 'channel', 'event', 'decision']}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" disabled={viewModel.loading} className="w-full">
                {viewModel.loading ? 'Saving…' : 'Save note'}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel} className="w-full">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>
    </form>
  )
}
