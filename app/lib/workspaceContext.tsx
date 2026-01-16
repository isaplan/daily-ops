/**
 * @registry-id: workspaceContext
 * @created: 2026-01-16T16:15:00.000Z
 * @last-modified: 2026-01-16T16:15:00.000Z
 * @description: Workspace context provider for active workspace filtering
 * @last-fix: [2026-01-16] Initial implementation for Design V2 workspace switching
 */

'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { WorkspaceId, WorkspaceFilter } from '@/lib/types/workspace.types'

const WORKSPACE_STORAGE_KEY = 'active-workspace'

interface WorkspaceContextValue {
  activeWorkspace: WorkspaceId
  setActiveWorkspace: (workspace: WorkspaceId) => void
  getWorkspaceFilter: () => WorkspaceFilter
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceId>('all')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY) as WorkspaceId | null
    if (stored && ['all', 'locations', 'daily-ops', 'global'].includes(stored)) {
      setActiveWorkspaceState(stored)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, activeWorkspace)
  }, [activeWorkspace])

  const setActiveWorkspace = (workspace: WorkspaceId) => {
    setActiveWorkspaceState(workspace)
  }

  const getWorkspaceFilter = useMemo(
    () => (): WorkspaceFilter => ({
      workspace_id: activeWorkspace,
    }),
    [activeWorkspace]
  )

  const value = useMemo(
    () => ({
      activeWorkspace,
      setActiveWorkspace,
      getWorkspaceFilter,
    }),
    [activeWorkspace, getWorkspaceFilter]
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
