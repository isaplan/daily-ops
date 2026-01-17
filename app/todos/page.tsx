/**
 * @registry-id: TodosPage
 * @created: 2026-01-16T22:30:00.000Z
 * @last-modified: 2026-01-17T00:00:00.000Z
 * @description: Todos page using MVVM pattern, Shadcn microcomponents, and proper SSR architecture
 * @last-fix: [2026-01-17] Complete rewrite to fix MVVM violations, Shadcn violations, and SSR violations
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useTodoViewModel.ts => Todo ViewModel
 *   - app/components/TodoForm.tsx => Todo form component
 *   - app/components/ui/** => Shadcn microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/layouts/DesignV2TopNav.tsx => Navigation to todos page
 */

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTodoViewModel } from '@/lib/viewmodels/useTodoViewModel'
import TodoForm from '@/components/TodoForm'
import ConnectionPicker from '@/components/ConnectionPicker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { Todo } from '@/lib/services/todoService'

function TodosContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewModel = useTodoViewModel()
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [filter, setFilter] = useState({ status: '', list_id: '' })

  useEffect(() => {
    viewModel.loadTodos({
      status: filter.status || undefined,
    })
    const todoId = searchParams.get('todo')
    if (todoId && viewModel.todos) {
      const todo = viewModel.todos.find((t) => t._id === todoId)
      if (todo) setSelectedTodo(todo)
    }
  }, [filter, searchParams])

  const handleBack = () => {
    const returnTo = searchParams.get('returnTo')
    if (returnTo) {
      router.push(returnTo)
    } else {
      router.back()
    }
  }

  const getStatusVariant = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'error'
      case 'in_progress':
        return 'warning'
      default:
        return 'default'
    }
  }

  if (viewModel.loading && viewModel.todos.length === 0) {
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Button variant="ghost" onClick={handleBack} className="mb-4">
            ← Back
          </Button>
          <h1 className="text-4xl font-bold mb-2">Todos</h1>
          <p className="text-muted-foreground">Manage and track todos</p>
            </div>
        <Button onClick={() => setShowCreateForm(true)}>+ New Todo</Button>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="filter-status-select">Filter by Status</Label>
          <Select
            value={filter.status || 'all'}
            onValueChange={(value) => setFilter({ ...filter, status: value === 'all' ? '' : value })}
          >
            <SelectTrigger id="filter-status-select" aria-label="Filter todos by status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {viewModel.error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{viewModel.error}</p>
          </CardContent>
        </Card>
      )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {selectedTodo ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-2xl">{selectedTodo.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTodo(null)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTodo.description && (
                  <p className="text-muted-foreground">{selectedTodo.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Status:</span>
                    <StatusBadge status={getStatusVariant(selectedTodo.status)}>
                      {selectedTodo.status}
                    </StatusBadge>
                  </div>
                  {selectedTodo.priority && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Priority:</span>
                      <Badge variant="secondary">{selectedTodo.priority}</Badge>
                    </div>
                  )}
                  {selectedTodo.assigned_to && (
                    <div>
                      <span className="font-medium">Assigned to:</span>{' '}
                      {typeof selectedTodo.assigned_to === 'object'
                        ? selectedTodo.assigned_to.name
                        : selectedTodo.assigned_to}
                    </div>
                  )}
                </div>

                {/* Many-to-Many Connections */}
                {selectedTodo._id && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-sm">LINKED ENTITIES</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Link this todo to other entities (notes, channels, events, decisions)
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ConnectionPicker
                        entityType="todo"
                        entityId={selectedTodo._id}
                        allowedTargetTypes={['note', 'channel', 'event', 'decision']}
                      />
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
            ) : (
              <div className="space-y-4">
              {viewModel.todos.length === 0 ? (
                <EmptyState
                  title="No todos found"
                  description="Create your first todo to get started"
                  action={
                    <Button onClick={() => setShowCreateForm(true)}>Create Todo</Button>
                  }
                />
              ) : (
                viewModel.todos.map((todo) => (
                  <Card
                      key={todo._id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedTodo(todo)}
                    >
                    <CardHeader>
                      <CardTitle className="text-lg">{todo.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {todo.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {todo.description}
                        </p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <StatusBadge status={getStatusVariant(todo.status)}>
                          {todo.status}
                        </StatusBadge>
                        {todo.priority && (
                          <Badge variant="secondary">{todo.priority}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create Todo Modal */}
        {showCreateForm && (
        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Todo</DialogTitle>
            </DialogHeader>
            <TodoForm
              onSave={() => {
                setShowCreateForm(false)
                viewModel.loadTodos(filter)
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default function TodosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <TodosContent />
    </Suspense>
  )
}
