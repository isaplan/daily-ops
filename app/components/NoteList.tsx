/**
 * @registry-id: NoteListComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T15:10:00.000Z
 * @description: Note list component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Fixed Select empty string values to use 'all' instead
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useNoteViewModel.ts => Note ViewModel
 *   - app/lib/viewmodels/useLocationViewModel.ts => Location ViewModel
 *   - app/lib/viewmodels/useTeamViewModel.ts => Team ViewModel
 *   - app/lib/viewmodels/useMemberViewModel.ts => Member ViewModel
 *   - app/lib/hooks/useAuth.ts => Auth hook
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/notes/page.tsx => Uses NoteList
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useNoteViewModel } from '@/lib/viewmodels/useNoteViewModel'
import { useLocationViewModel } from '@/lib/viewmodels/useLocationViewModel'
import { useTeamViewModel } from '@/lib/viewmodels/useTeamViewModel'
import { useMemberViewModel } from '@/lib/viewmodels/useMemberViewModel'
import { useAuth } from '@/lib/hooks/useAuth'
import NoteForm from './NoteForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
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
import { Switch } from '@/components/ui/switch'

export default function NoteList() {
  const { user } = useAuth()
  const viewModel = useNoteViewModel()
  const locationViewModel = useLocationViewModel()
  const teamViewModel = useTeamViewModel()
  const memberViewModel = useMemberViewModel()
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<any>(null)
  const [filter, setFilter] = useState({
    location_id: '',
    team_id: '',
    member_id: '',
    archived: false,
  })
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    const filters: any = { ...filter }
    if (!filters.location_id && !filters.team_id && !filters.member_id && user?.id) {
      filters.viewing_member_id = user.id
    }
    viewModel.loadNotes(filters)
    locationViewModel.loadLocations()
    teamViewModel.loadTeams()
    memberViewModel.loadMembers()
  }, [filter, user?.id])

  const handleDelete = async (id: string) => {
    await viewModel.deleteNote(id)
    if (!viewModel.error) {
      setDeleteConfirm(null)
    }
  }

  const handleArchive = async (note: any) => {
    await viewModel.updateNote(note._id, {
      is_archived: !note.is_archived,
    })
  }

  if (viewModel.loading && viewModel.notes.length === 0) {
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
        <h2 className="text-2xl font-bold">Notes ({viewModel.notes.length})</h2>
        <Button
          onClick={() => {
            setEditingNote(null)
            setShowForm(true)
          }}
        >
          + Create Note
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Location</Label>
          <Select
            value={filter.location_id || 'all'}
            onValueChange={(value) => setFilter({ ...filter, location_id: value === 'all' ? '' : value, team_id: '' })}
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
          <Label>Team</Label>
          <Select
            value={filter.team_id || 'all'}
            onValueChange={(value) => setFilter({ ...filter, team_id: value === 'all' ? '' : value })}
            disabled={!filter.location_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teamViewModel.teams
                .filter((t) => {
                  const teamLocId = typeof t.location_id === 'object' ? t.location_id._id : t.location_id
                  return !filter.location_id || teamLocId === filter.location_id
                })
                .map((team) => (
                  <SelectItem key={team._id} value={team._id}>
                    {team.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Member</Label>
          <Select
            value={filter.member_id || 'all'}
            onValueChange={(value) => setFilter({ ...filter, member_id: value === 'all' ? '' : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {memberViewModel.members.map((member) => (
                <SelectItem key={member._id} value={member._id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Show Archived</Label>
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              checked={filter.archived}
              onCheckedChange={(checked) => setFilter({ ...filter, archived: checked })}
            />
            <Label>{filter.archived ? 'Showing archived' : 'Hide archived'}</Label>
          </div>
        </div>
      </div>

      {viewModel.error && (
        <Alert variant="destructive">
          <AlertDescription>{viewModel.error}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <NoteForm
          note={editingNote}
          onSave={() => {
            setShowForm(false)
            setEditingNote(null)
            const filters: any = { ...filter }
            if (!filters.location_id && !filters.team_id && !filters.member_id && user?.id) {
              filters.viewing_member_id = user.id
            }
            viewModel.loadNotes(filters)
          }}
          onCancel={() => {
            setShowForm(false)
            setEditingNote(null)
          }}
        />
      )}

      {viewModel.notes.length === 0 ? (
        <EmptyState
          title="No notes found"
          description="Create one above to get started"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {viewModel.notes.map((note) => (
            <Card
              key={note._id}
              className={note.is_pinned ? 'border-yellow-400 border-2' : ''}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  {note.is_pinned && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                      📌 PINNED
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{note.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                  {note.content}
                </p>

                {note.connected_to && (
                  <div className="text-xs text-muted-foreground mb-2 space-y-1">
                    {note.connected_to.location_id &&
                      typeof note.connected_to.location_id === 'object' &&
                      note.connected_to.location_id.name && (
                        <div>
                          📍{' '}
                          <Link
                            href={`/locations/${note.connected_to.location_id._id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {note.connected_to.location_id.name}
                          </Link>
                        </div>
                      )}
                    {note.connected_to.team_id &&
                      typeof note.connected_to.team_id === 'object' &&
                      note.connected_to.team_id.name && (
                        <div>
                          👥{' '}
                          <Link
                            href={`/teams/${note.connected_to.team_id._id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {note.connected_to.team_id.name}
                          </Link>
                        </div>
                      )}
                    {note.connected_to.member_id &&
                      typeof note.connected_to.member_id === 'object' &&
                      note.connected_to.member_id.name && (
                        <div>
                          👤{' '}
                          <Link
                            href={`/members/${note.connected_to.member_id._id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {note.connected_to.member_id.name}
                          </Link>
                        </div>
                      )}
                  </div>
                )}

                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {note.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="text-xs text-muted-foreground mb-3">
                  by{' '}
                  {note.author_id && typeof note.author_id === 'object' ? (
                    <Link
                      href={`/members/${note.author_id._id || note.author_id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {note.author_id.name || 'Unknown'}
                    </Link>
                  ) : (
                    'Unknown'
                  )}{' '}
                  • {new Date(note.created_at).toLocaleDateString()}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/notes/${note.slug || note._id}`}>View</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArchive(note)}
                  >
                    {note.is_archived ? 'Unarchive' : 'Archive'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteConfirm({ id: note._id, title: note.title })}
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
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone.
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
