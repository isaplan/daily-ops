/**
 * @registry-id: ConnectionSheetComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Connection sheet component using Sheet microcomponent and connectionService
 * @last-fix: [2026-01-16] Refactored to use Sheet microcomponent + connectionService
 * 
 * @imports-from:
 *   - app/lib/services/connectionService.ts => Connection service
 *   - app/lib/types/connections.ts => Connection types
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use ConnectionSheet for displaying connections
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { connectionService } from '@/lib/services/connectionService'
import type { ConnectionsResponse } from '@/lib/types/connections'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'

interface ConnectionSheetProps {
  entityType: 'member' | 'team' | 'location'
  entityId: string
  entityTitle: string
}

export default function ConnectionSheet({
  entityType,
  entityId,
  entityTitle,
}: ConnectionSheetProps) {
  const router = useRouter()
  const [connections, setConnections] = useState<ConnectionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (entityId) {
      setLoading(true)
      connectionService
        .getConnections(entityType, entityId)
        .then((response) => {
          if (response.success && response.data) {
            // Transform the response to match ConnectionsResponse format
            // The API returns connections array, we need to transform it
            setConnections(response.data as any)
          } else {
            setError(response.error || 'Failed to load connections')
          }
          setLoading(false)
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load connections')
          setLoading(false)
        })
    }
  }, [entityId, entityType])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!connections) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">No connections found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {entityType === 'location' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{(connections as any).teams || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-indigo-700">
                  {(connections as any).members || 0}
                </div>
              </CardContent>
            </Card>
          </>
        )}
        {entityType === 'team' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{(connections as any).members || 0}</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{connections.notes || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Todos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{connections.todos || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">
              {connections.decisions || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700">{connections.channels || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Notes Section */}
      {connections.details?.notes && connections.details.notes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Notes ({connections.details.notes.length})
          </h3>
          <div className="space-y-2">
            {connections.details.notes.map((note) => (
              <Card
                key={note._id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  router.push(`/notes/${note.slug || note._id}`)
                }}
              >
                <CardHeader>
                  <CardTitle className="text-base">{note.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {note.content}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    by{' '}
                    {note.author_id && typeof note.author_id === 'object' ? (
                      <Button variant="link" className="p-0 h-auto text-xs" asChild>
                        <a href={`/members/${note.author_id._id || note.author_id}`}>
                          {note.author_id.name || 'Unknown'}
                        </a>
                      </Button>
                    ) : (
                      'Unknown'
                    )}{' '}
                    • {new Date(note.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Todos Section */}
      {connections.details?.todos && connections.details.todos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Todos ({connections.details.todos.length})
          </h3>
          <div className="space-y-2">
            {connections.details.todos.map((todo) => (
              <Card
                key={todo._id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  router.push(`/todos?todo=${todo._id}`)
                }}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{todo.title}</CardTitle>
                    <StatusBadge
                      status={
                        todo.status === 'completed'
                          ? 'success'
                          : todo.status === 'in_progress'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {todo.status}
                    </StatusBadge>
                  </div>
                </CardHeader>
                <CardContent>
                  {todo.description && (
                    <p className="text-sm text-muted-foreground mb-2">{todo.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Assigned to:{' '}
                    {todo.assigned_to && typeof todo.assigned_to === 'object' ? (
                      <Button variant="link" className="p-0 h-auto text-xs" asChild>
                        <a href={`/members/${todo.assigned_to._id || todo.assigned_to}`}>
                          {todo.assigned_to.name || 'Unknown'}
                        </a>
                      </Button>
                    ) : (
                      'Unknown'
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Decisions Section */}
      {connections.details?.decisions && connections.details.decisions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Decisions ({connections.details.decisions.length})
          </h3>
          <div className="space-y-2">
            {connections.details.decisions.map((decision) => (
              <Card
                key={decision._id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  router.push(`/decisions?decision=${decision._id}`)
                }}
              >
                <CardHeader>
                  <CardTitle className="text-base">{decision.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">{decision.description}</p>
                  <div className="text-sm font-medium mb-2">Decision: {decision.decision}</div>
                  <div className="flex justify-between items-center">
                    <StatusBadge
                      status={
                        decision.status === 'approved'
                          ? 'success'
                          : decision.status === 'rejected'
                            ? 'error'
                            : decision.status === 'implemented'
                              ? 'info'
                              : 'default'
                      }
                    >
                      {decision.status}
                    </StatusBadge>
                    <div className="text-xs text-muted-foreground">
                      by{' '}
                      {decision.created_by && typeof decision.created_by === 'object' ? (
                        <Button variant="link" className="p-0 h-auto text-xs" asChild>
                          <a href={`/members/${decision.created_by._id || decision.created_by}`}>
                            {decision.created_by.name || 'Unknown'}
                          </a>
                        </Button>
                      ) : (
                        'Unknown'
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Channels Section */}
      {connections.details?.channels && connections.details.channels.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Channels ({connections.details.channels.length})
          </h3>
          <div className="space-y-2">
            {connections.details.channels.map((channel) => (
              <Card
                key={channel._id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  router.push(`/channels/${channel._id}`)
                }}
              >
                <CardHeader>
                  <CardTitle className="text-base">{channel.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {channel.description && (
                    <p className="text-sm text-muted-foreground mb-2">{channel.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {channel.members?.length || 0} members • Type:{' '}
                    <Badge variant="secondary">{channel.type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
