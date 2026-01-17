/**
 * @registry-id: workspaceContext
 * @created: 2026-01-16T16:15:00.000Z
 * @last-modified: 2026-01-16T16:20:00.000Z
 * @description: Workspace context provider for active workspace filtering
 * @last-fix: [2026-01-16] Added location-specific filtering for teams and members
 */

'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { WorkspaceId, WorkspaceFilter } from '@/lib/types/workspace.types'

const WORKSPACE_STORAGE_KEY = 'active-workspace'

interface WorkspaceContextValue {
  activeWorkspace: WorkspaceId
  setActiveWorkspace: (workspace: WorkspaceId) => void
  getWorkspaceFilter: () => WorkspaceFilter
  activeLocationId: string | null
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

const WORKSPACE_TO_LOCATION_NAME: Record<string, string> = {
  hnh: 'Haagse Nieuwe Horeca Groep',
  vkb: 'van Kinsbergen',
  bea: 'Bar Bea',
  lat: "l'AMour-Toujours",
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceId>('all')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY) as WorkspaceId | null
    if (stored && ['all', 'hnh', 'vkb', 'bea', 'lat', 'daily-ops'].includes(stored)) {
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

  const activeLocationId = useMemo(() => {
    if (activeWorkspace === 'all' || activeWorkspace === 'daily-ops') {
      return null
    }
    return WORKSPACE_TO_LOCATION_NAME[activeWorkspace] || null
  }, [activeWorkspace])

  const getWorkspaceFilter = useMemo(
    () => (): WorkspaceFilter => {
      const filter: WorkspaceFilter = {
        workspace_id: activeWorkspace,
      }
      if (activeLocationId) {
        filter.location_name = activeLocationId
      }
      return filter
    },
    [activeWorkspace, activeLocationId]
  )

  const value = useMemo(
    () => ({
      activeWorkspace,
      setActiveWorkspace,
      getWorkspaceFilter,
      activeLocationId,
    }),
    [activeWorkspace, getWorkspaceFilter, activeLocationId]
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
