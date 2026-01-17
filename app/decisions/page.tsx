/**
 * @registry-id: DecisionsPage
 * @created: 2026-01-16T22:30:00.000Z
 * @last-modified: 2026-01-17T00:00:00.000Z
 * @description: Decisions page using MVVM pattern, Shadcn microcomponents, and proper SSR architecture
 * @last-fix: [2026-01-17] Complete rewrite to fix MVVM violations, Shadcn violations, and SSR violations
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useDecisionViewModel.ts => Decision ViewModel
 *   - app/components/DecisionForm.tsx => Decision form component
 *   - app/components/ui/** => Shadcn microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/layouts/DesignV2TopNav.tsx => Navigation to decisions page
 */

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useDecisionViewModel } from '@/lib/viewmodels/useDecisionViewModel'
import DecisionForm from '@/components/DecisionForm'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Decision } from '@/lib/services/decisionService'

function DecisionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewModel = useDecisionViewModel()
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    viewModel.loadDecisions()
    const decisionId = searchParams.get('decision')
    if (decisionId && viewModel.decisions) {
      const decision = viewModel.decisions.find((d) => d._id === decisionId)
      if (decision) setSelectedDecision(decision)
    }
  }, [searchParams])

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
      case 'approved':
      case 'implemented':
        return 'success'
      case 'rejected':
        return 'error'
      case 'proposed':
        return 'warning'
      default:
        return 'default'
    }
  }

  if (viewModel.loading && viewModel.decisions.length === 0) {
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
          <h1 className="text-4xl font-bold mb-2">Decisions</h1>
          <p className="text-muted-foreground">View and manage decisions</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>+ Create Decision</Button>
      </div>

      {viewModel.error && (
        <Alert variant="destructive">
          <AlertDescription>{viewModel.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {selectedDecision ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-2xl">{selectedDecision.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDecision(null)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedDecision.description && (
                  <p className="text-muted-foreground">{selectedDecision.description}</p>
                )}
                <Alert>
                  <AlertDescription>
                    <div className="font-semibold mb-2">Decision:</div>
                    <div>{selectedDecision.decision}</div>
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Status:</span>
                    <StatusBadge status={getStatusVariant(selectedDecision.status)}>
                      {selectedDecision.status}
                    </StatusBadge>
                  </div>
                  {selectedDecision.created_by && (
                    <div>
                      <span className="font-medium">Created by:</span>{' '}
                      {typeof selectedDecision.created_by === 'object'
                        ? selectedDecision.created_by.name
                        : selectedDecision.created_by}
                    </div>
                  )}
                </div>

                {/* Many-to-Many Connections */}
                {selectedDecision._id && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-sm">LINKED ENTITIES</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Link this decision to other entities (notes, todos, channels, events)
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ConnectionPicker
                        entityType="decision"
                        entityId={selectedDecision._id}
                        allowedTargetTypes={['note', 'todo', 'channel', 'event']}
                      />
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {viewModel.decisions.length === 0 ? (
                <EmptyState
                  title="No decisions found"
                  description="Create your first decision to get started"
                  action={
                    <Button onClick={() => setShowCreateForm(true)}>Create Decision</Button>
                  }
                />
              ) : (
                viewModel.decisions.map((decision) => (
                  <Card
                    key={decision._id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedDecision(decision)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{decision.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {decision.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {decision.description}
                        </p>
                      )}
                      <StatusBadge status={getStatusVariant(decision.status)}>
                        {decision.status}
                      </StatusBadge>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Decision Modal */}
      {showCreateForm && (
        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Decision</DialogTitle>
            </DialogHeader>
            <DecisionForm
              onSave={() => {
                setShowCreateForm(false)
                viewModel.loadDecisions()
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default function DecisionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <DecisionsContent />
    </Suspense>
  )
}
