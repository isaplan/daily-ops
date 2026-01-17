/**
 * @registry-id: ConnectionPicker
 * @created: 2026-01-16T22:00:00.000Z
 * @last-modified: 2026-01-16T22:00:00.000Z
 * @description: Connection picker component for many-to-many entity linking
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useConnectionViewModel.ts => Connection state management
 *   - app/lib/services/connectionService.ts => Connection API operations
 *   - app/lib/services/noteService.ts => Fetch available notes
 *   - app/lib/services/todoService.ts => Fetch available todos
 *   - app/lib/services/channelService.ts => Fetch available channels
 *   - app/lib/services/eventService.ts => Fetch available events
 *   - app/components/ui/** => Shadcn microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/NoteForm.tsx => Connection picker in note forms
 *   ✓ app/components/TodoForm.tsx => Connection picker in todo forms
 *   ✓ app/components/EventForm.tsx => Connection picker in event forms
 *   ✓ app/components/DecisionForm.tsx => Connection picker in decision forms
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useConnectionViewModel } from '@/lib/viewmodels/useConnectionViewModel'
import { noteService, type Note } from '@/lib/services/noteService'
import { todoService, type Todo } from '@/lib/services/todoService'
import { channelService, type Channel } from '@/lib/services/channelService'
import { eventService, type Event } from '@/lib/services/eventService'
import type { EntityType, LinkedEntityDisplay } from '@/lib/types/connections'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Search, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ConnectionPickerProps {
  entityType: EntityType
  entityId: string
  allowedTargetTypes?: EntityType[]
  onConnectionsChange?: (connections: LinkedEntityDisplay[]) => void
  className?: string
}

interface EntityOption {
  type: EntityType
  id: string
  title: string
  name?: string
  slug?: string
}

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  note: 'Notes',
  todo: 'Todos',
  channel: 'Channels',
  event: 'Events',
  decision: 'Decisions',
}

export default function ConnectionPicker({
  entityType,
  entityId,
  allowedTargetTypes = ['note', 'todo', 'channel', 'event', 'decision'],
  onConnectionsChange,
  className,
}: ConnectionPickerProps) {
  const connectionViewModel = useConnectionViewModel()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [availableEntities, setAvailableEntities] = useState<EntityOption[]>([])
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set())
  const [loadingEntities, setLoadingEntities] = useState(false)
  const [selectedType, setSelectedType] = useState<EntityType | ''>('')

  // Load existing connections
  useEffect(() => {
    if (entityId) {
      connectionViewModel.getLinkedEntities({
        entity_type: entityType,
        entity_id: entityId,
        skip: 0,
        limit: 100,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityType])

  // Update selected IDs when connections load
  useEffect(() => {
    const ids = new Set(connectionViewModel.linkedEntities.map((e) => e.id))
    setSelectedEntityIds(ids)
    if (onConnectionsChange) {
      onConnectionsChange(connectionViewModel.linkedEntities)
    }
  }, [connectionViewModel.linkedEntities, onConnectionsChange])

  // Load available entities for selected type
  const loadAvailableEntities = useCallback(
    async (type: EntityType) => {
      if (!type) return

      setLoadingEntities(true)
      try {
        let entities: EntityOption[] = []

        switch (type) {
          case 'note': {
            const notesResponse = await noteService.getAll({}, 0, 100)
            if (notesResponse.success && notesResponse.data) {
              entities = notesResponse.data.map((note: Note) => ({
                type: 'note' as EntityType,
                id: note._id,
                title: note.title,
                slug: note.slug,
              }))
            }
            break
          }
          case 'todo': {
            const todosResponse = await todoService.getAll({}, 0, 100)
            if (todosResponse.success && todosResponse.data) {
              entities = todosResponse.data.map((todo: Todo) => ({
                type: 'todo' as EntityType,
                id: todo._id,
                title: todo.title,
              }))
            }
            break
          }
          case 'channel': {
            const channelsResponse = await channelService.getAll({}, 0, 100)
            if (channelsResponse.success && channelsResponse.data) {
              entities = channelsResponse.data.map((channel: Channel) => ({
                type: 'channel' as EntityType,
                id: channel._id,
                title: channel.name,
                name: channel.name,
              }))
            }
            break
          }
          case 'event': {
            const eventsResponse = await eventService.getAll({}, 0, 100)
            if (eventsResponse.success && eventsResponse.data) {
              entities = eventsResponse.data.map((event: Event) => ({
                type: 'event' as EntityType,
                id: event._id,
                title: event.name,
                name: event.name,
              }))
            }
            break
          }
          case 'decision': {
            // Decision service doesn't exist yet, skip for now
            entities = []
            break
          }
        }

        // Filter out current entity and already connected entities
        // Use connectionViewModel.linkedEntities directly to avoid stale closure
        const linkedEntities = connectionViewModel.linkedEntities
        const connectedIds = new Set(linkedEntities.map((e) => e.id))
        entities = entities.filter(
          (e) => e.id !== entityId && !connectedIds.has(e.id)
        )

        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          entities = entities.filter(
            (e) =>
              e.title.toLowerCase().includes(query) ||
              e.name?.toLowerCase().includes(query) ||
              e.slug?.toLowerCase().includes(query)
          )
        }

        setAvailableEntities(entities)
      } catch (error) {
        console.error(`Failed to load ${type} entities:`, error)
      } finally {
        setLoadingEntities(false)
      }
    },
    [entityId, searchQuery, connectionViewModel.linkedEntities]
  )

  // Load entities when type changes
  useEffect(() => {
    if (selectedType && isOpen) {
      loadAvailableEntities(selectedType)
    }
  }, [selectedType, isOpen, loadAvailableEntities])

  const handleToggleEntity = useCallback(
    async (entity: EntityOption, checked: boolean) => {
      if (checked) {
        // Add connection
        const success = await connectionViewModel.createLink(
          entityType,
          entityId,
          entity.type,
          entity.id
        )
        if (success) {
          setSelectedEntityIds((prev) => new Set([...prev, entity.id]))
        }
      } else {
        // Remove connection
        const success = await connectionViewModel.removeLink(
          entityType,
          entityId,
          entity.type,
          entity.id
        )
        if (success) {
          setSelectedEntityIds((prev) => {
            const next = new Set(prev)
            next.delete(entity.id)
            return next
          })
        }
      }
    },
    [entityType, entityId, connectionViewModel]
  )

  const handleRemoveConnection = useCallback(
    async (connection: LinkedEntityDisplay) => {
      const success = await connectionViewModel.removeLink(
        entityType,
        entityId,
        connection.type,
        connection.id
      )
      if (success) {
        setSelectedEntityIds((prev) => {
          const next = new Set(prev)
          next.delete(connection.id)
          return next
        })
      }
    },
    [entityType, entityId, connectionViewModel]
  )

  const filteredConnections = connectionViewModel.linkedEntities.filter((conn) =>
    allowedTargetTypes.includes(conn.type)
  )

  return (
    <div className={cn('space-y-2', className)}>
      <Label>Connections</Label>
      
      {/* Display existing connections */}
      {connectionViewModel.loading && filteredConnections.length === 0 ? (
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      ) : filteredConnections.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {filteredConnections.map((connection) => (
            <Badge
              key={`${connection.type}-${connection.id}`}
              variant="secondary"
              className="flex items-center gap-1"
            >
              <span className="text-xs">
                {ENTITY_TYPE_LABELS[connection.type]}: {connection.title || connection.name || connection.id.slice(0, 8)}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveConnection(connection)}
                className="ml-1 rounded-full hover:bg-destructive/20"
                aria-label={`Remove ${connection.title || connection.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No connections</p>
      )}

      {/* Error display */}
      {connectionViewModel.error && (
        <Alert variant="destructive">
          <AlertDescription>{connectionViewModel.error}</AlertDescription>
        </Alert>
      )}

      {/* Add connection popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full">
            <Link2 className="mr-2 h-4 w-4" />
            Link to...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Link to Entity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type selector */}
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <div className="flex flex-wrap gap-2">
                  {allowedTargetTypes.map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={selectedType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedType(type)
                        setSearchQuery('')
                      }}
                    >
                      {ENTITY_TYPE_LABELS[type]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Search */}
              {selectedType && (
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search ${ENTITY_TYPE_LABELS[selectedType]}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              )}

              {/* Entity list */}
              {selectedType && (
                <div className="space-y-2">
                  <Label>Available {ENTITY_TYPE_LABELS[selectedType]}</Label>
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {loadingEntities ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : availableEntities.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No {ENTITY_TYPE_LABELS[selectedType].toLowerCase()} available
                      </p>
                    ) : (
                      availableEntities.map((entity) => {
                        const isSelected = selectedEntityIds.has(entity.id)
                        return (
                          <div
                            key={`${entity.type}-${entity.id}`}
                            className="flex items-center space-x-2 rounded-md border p-2 hover:bg-accent"
                          >
                            <Checkbox
                              id={`entity-${entity.id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                handleToggleEntity(entity, checked === true)
                              }
                              disabled={connectionViewModel.loading}
                            />
                            <Label
                              htmlFor={`entity-${entity.id}`}
                              className="flex-1 cursor-pointer text-sm"
                            >
                              {entity.title || entity.name || entity.id.slice(0, 8)}
                            </Label>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {!selectedType && (
                <p className="text-sm text-muted-foreground">
                  Select an entity type to link
                </p>
              )}
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  )
}
