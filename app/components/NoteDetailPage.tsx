/**
 * @registry-id: NoteDetailPageComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Note detail page component using MVVM pattern and microcomponents
 * @last-fix: [2026-01-16] Refactored to use useNoteViewModel + microcomponents
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useNoteViewModel.ts => Note ViewModel
 *   - app/lib/viewmodels/useMemberViewModel.ts => Member ViewModel
 *   - app/lib/services/noteService.ts => Note service for member operations
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/notes/[slug]/page.tsx => Uses NoteDetailPage
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useNoteViewModel } from '@/lib/viewmodels/useNoteViewModel'
import { useMemberViewModel } from '@/lib/viewmodels/useMemberViewModel'
import { noteService } from '@/lib/services/noteService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConnectedMember {
  member_id: { _id: string; name: string; email?: string } | string
  role?: 'responsible' | 'attending' | 'reviewer' | 'contributor'
  added_at?: string
}

interface NoteDetailPageProps {
  slug: string
}

export default function NoteDetailPage({ slug }: NoteDetailPageProps) {
  const router = useRouter()
  const [note, setNote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({ title: '', content: '' })
  const [actionLoading, setActionLoading] = useState(false)
  const memberViewModel = useMemberViewModel()
  const [showAddMember, setShowAddMember] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedRole, setSelectedRole] = useState<
    'responsible' | 'attending' | 'reviewer' | 'contributor'
  >('contributor')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [parseTodosConfirm, setParseTodosConfirm] = useState(false)

  useEffect(() => {
    if (slug && slug !== 'undefined') {
      fetchNote()
      memberViewModel.loadMembers()
    } else {
      setError('Invalid note identifier')
      setLoading(false)
    }
  }, [slug])

  const fetchNote = async () => {
    if (!slug || slug === 'undefined') {
      setError('Invalid note identifier')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await noteService.getBySlug(slug)
      if (response.success && response.data) {
        setNote(response.data)
        setEditData({ title: response.data.title, content: response.data.content })
      } else {
        setError(response.error || 'Failed to load note')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!note) return
    try {
      setActionLoading(true)
      const response = await noteService.update(note._id, {
        title: editData.title,
        content: editData.content,
        location_id: note.connected_to?.location_id?._id,
        team_id: note.connected_to?.team_id?._id,
        member_id: note.connected_to?.member_id?._id,
        tags: note.tags,
        is_pinned: note.is_pinned,
        is_archived: note.is_archived,
      })
      if (response.success && response.data) {
        setNote(response.data)
        setIsEditing(false)
      } else {
        setError(response.error || 'Failed to save')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!note) return
    try {
      setActionLoading(true)
      const response = await noteService.update(note._id, {
        publish: note.status === 'draft',
      })
      if (response.success && response.data) {
        setNote(response.data)
      } else {
        setError(response.error || 'Failed to update status')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePin = async () => {
    if (!note) return
    try {
      setActionLoading(true)
      const response = await noteService.update(note._id, {
        is_pinned: !note.is_pinned,
      })
      if (response.success && response.data) {
        setNote(response.data)
      } else {
        setError(response.error || 'Failed to update pin status')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  const handleArchive = async () => {
    if (!note) return
    try {
      setActionLoading(true)
      const response = await noteService.update(note._id, {
        is_archived: !note.is_archived,
      })
      if (response.success && response.data) {
        setNote(response.data)
      } else {
        setError(response.error || 'Failed to update archive status')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!note) return
    try {
      setActionLoading(true)
      const response = await noteService.delete(note._id)
      if (response.success) {
        router.push('/notes')
      } else {
        setError(response.error || 'Failed to delete')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
      setDeleteConfirm(false)
    }
  }

  const handleAddMember = async () => {
    if (!note || !selectedMemberId) return
    try {
      setActionLoading(true)
      const response = await fetch(`/api/notes/${note._id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMemberId,
          role: selectedRole,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setNote(data.data)
        setShowAddMember(false)
        setSelectedMemberId('')
      } else {
        setError(data.error || 'Failed to add member')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!note) return
    try {
      setActionLoading(true)
      const response = await fetch(`/api/notes/${note._id}/members?member_id=${memberId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        setNote(data.data)
      } else {
        setError(data.error || 'Failed to remove member')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  const handleParseTodos = async () => {
    if (!note) return
    try {
      setActionLoading(true)
      const response = await fetch(`/api/notes/${note._id}/parse-todos`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        alert(`Successfully created ${data.data.count} todo(s) from note content!`)
        fetchNote()
      } else {
        setError(data.error || 'Failed to parse todos')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
      setParseTodosConfirm(false)
    }
  }

  const getMemberId = (member: ConnectedMember['member_id']): string => {
    return typeof member === 'object' ? member._id : member
  }

  const getMemberName = (member: ConnectedMember['member_id']): string => {
    return typeof member === 'object' ? member.name : 'Unknown'
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-3xl mx-auto">
          <Button variant="link" asChild className="mb-8">
            <Link href="/notes">← Back to Notes</Link>
          </Button>
          <Alert variant="destructive">
            <AlertDescription>{error || 'Note not found'}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  const availableMembers = memberViewModel.members.filter((m) => {
    if (!note.connected_members || note.connected_members.length === 0) return true
    return !note.connected_members.some((cm: ConnectedMember) => getMemberId(cm.member_id) === m._id)
  })

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="link" asChild className="mb-6">
          <Link href="/notes">← Back to Notes</Link>
        </Button>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="text-3xl font-bold mb-2"
                  />
                ) : (
                  <>
                    <CardTitle className="text-3xl mb-2">{note.title}</CardTitle>
                    {note.is_pinned && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                        📌 PINNED
                      </Badge>
                    )}
                  </>
                )}
              </div>
              <StatusBadge
                status={note.status === 'published' ? 'success' : 'warning'}
              >
                {note.status.charAt(0).toUpperCase() + note.status.slice(1)}
              </StatusBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metadata */}
            <div className="text-sm text-muted-foreground space-y-1">
              {note.author_id && typeof note.author_id === 'object' && (
                <div>
                  <strong>Author:</strong>{' '}
                  <Button variant="link" className="p-0 h-auto" asChild>
                    <Link href={`/members/${note.author_id._id}`}>{note.author_id.name}</Link>
                  </Button>
                </div>
              )}
              <div>
                <strong>Created:</strong> {new Date(note.created_at).toLocaleDateString()}
              </div>
              {note.published_at && (
                <div>
                  <strong>Published:</strong> {new Date(note.published_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Connections */}
            {note.connected_to && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">READ ACCESS (Team/Location)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {note.connected_to.location_id &&
                    typeof note.connected_to.location_id === 'object' && (
                      <div className="text-sm">
                        📍{' '}
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <Link href={`/locations/${note.connected_to.location_id._id}`}>
                            {note.connected_to.location_id.name}
                          </Link>
                        </Button>
                      </div>
                    )}
                  {note.connected_to.team_id && typeof note.connected_to.team_id === 'object' && (
                    <div className="text-sm">
                      👥{' '}
                      <Button variant="link" className="p-0 h-auto" asChild>
                        <Link href={`/teams/${note.connected_to.team_id._id}`}>
                          {note.connected_to.team_id.name}
                        </Link>
                      </Button>
                    </div>
                  )}
                  {note.connected_to.member_id &&
                    typeof note.connected_to.member_id === 'object' && (
                      <div className="text-sm">
                        👤{' '}
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <Link href={`/members/${note.connected_to.member_id._id}`}>
                            {note.connected_to.member_id.name}
                          </Link>
                        </Button>
                      </div>
                    )}
                </CardContent>
              </Card>
            )}

            {/* Connected Members */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">RESPONSIBLE MEMBERS</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Members responsible for decisions, todos, and management
                    </p>
                  </div>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddMember(!showAddMember)}
                    >
                      + Add Member
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showAddMember && (
                  <Card>
                    <CardContent className="pt-6 space-y-3">
                      {availableMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          All members are already connected to this note
                        </p>
                      ) : (
                        <>
                          <Select
                            value={selectedMemberId}
                            onValueChange={setSelectedMemberId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Member" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableMembers.map((member) => (
                                <SelectItem key={member._id} value={member._id}>
                                  {member.name} ({member.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contributor">Contributor</SelectItem>
                              <SelectItem value="attending">Attending</SelectItem>
                              <SelectItem value="reviewer">Reviewer</SelectItem>
                              <SelectItem value="responsible">Responsible</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleAddMember}
                              disabled={!selectedMemberId || actionLoading}
                              size="sm"
                            >
                              Add
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowAddMember(false)
                                setSelectedMemberId('')
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {note.connected_members && note.connected_members.length > 0 ? (
                  <div className="space-y-2">
                    {note.connected_members.map((cm: ConnectedMember, idx: number) => {
                      const memberId = getMemberId(cm.member_id)
                      const memberName = getMemberName(cm.member_id)
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div className="flex items-center gap-2">
                            <Button variant="link" className="p-0 h-auto" asChild>
                              <Link href={`/members/${memberId}`}>{memberName}</Link>
                            </Button>
                            <Badge variant="secondary">{cm.role || 'contributor'}</Badge>
                          </div>
                          {!isEditing && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(memberId)}
                              disabled={actionLoading}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No members connected yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Content */}
            {isEditing ? (
              <Textarea
                value={editData.content}
                onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                rows={12}
                className="font-mono text-sm"
              />
            ) : (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {note.content}
              </div>
            )}

            {/* Linked Todos Info */}
            {note.linked_todos && note.linked_todos.length > 0 && (
              <Alert>
                <AlertDescription>
                  📋 Linked Todos ({note.linked_todos.length}) - This note has{' '}
                  {note.linked_todos.length} todo(s) linked to it. View them in the Todos section.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="border-t pt-6 flex flex-wrap gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setEditData({ title: note.title, content: note.content })
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setIsEditing(true)}>✎ Edit</Button>
                  <Button
                    variant="outline"
                    onClick={() => setParseTodosConfirm(true)}
                    disabled={actionLoading}
                  >
                    📋 Parse Todos
                  </Button>
                  <Button
                    variant={note.status === 'published' ? 'outline' : 'default'}
                    onClick={handlePublish}
                    disabled={actionLoading}
                  >
                    {note.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    variant={note.is_pinned ? 'outline' : 'secondary'}
                    onClick={handlePin}
                    disabled={actionLoading}
                  >
                    {note.is_pinned ? '📌 Unpin' : '📌 Pin'}
                  </Button>
                  <Button
                    variant={note.is_archived ? 'outline' : 'secondary'}
                    onClick={handleArchive}
                    disabled={actionLoading}
                  >
                    {note.is_archived ? '📦 Restore' : '📦 Archive'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteConfirm(true)}
                    disabled={actionLoading}
                    className="ml-auto"
                  >
                    🗑️ Delete
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={parseTodosConfirm} onOpenChange={setParseTodosConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parse Todos</DialogTitle>
            <DialogDescription>
              This will parse todos from the note content and create them. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParseTodosConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleParseTodos}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
