/**
 * @registry-id: DesignV2WorkspaceSwitcher
 * @created: 2026-01-16T15:00:00.000Z
 * @last-modified: 2026-01-16T15:00:00.000Z
 * @description: Compact workspace switcher sidebar (Slack-style) for Design V2
 * @last-fix: [2026-01-16] Initial workspace switcher implementation
 * 
 * @imports-from:
 *   - app/components/ui/badge.tsx => Badge component
 * 
 * @exports-to:
 *   ✓ app/components/layouts/DesignV2Layout.tsx => Workspace switcher column
 */

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { useWorkspace } from '@/lib/workspaceContext'
import type { WorkspaceId } from '@/lib/types/workspace.types'

const workspaces = [
  {
    id: 'all',
    label: 'All',
    fullName: 'All Operations',
    detail: 'Master workspace',
    initials: 'AO',
    color: 'from-indigo-500 to-blue-500',
  },
  {
    id: 'locations',
    label: 'Locations',
    fullName: 'Location Hubs',
    detail: 'Plant / market',
    initials: 'LH',
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'daily-ops',
    label: 'Daily Ops',
    fullName: 'Daily Ops HQ',
    detail: 'Management + partners',
    initials: 'DO',
    color: 'from-cyan-500 to-teal-500',
  },
  {
    id: 'global',
    label: 'Global',
    fullName: 'Global Enterprise',
    detail: 'Enterprise view',
    initials: 'GE',
    color: 'from-purple-500 to-pink-500',
  },
]

export default function DesignV2WorkspaceSwitcher() {
  const { activeWorkspace, setActiveWorkspace } = useWorkspace()
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <aside className="w-16 border-r border-white/10 bg-slate-900/60 p-2">
      <div className="flex flex-col items-center gap-3">
        {workspaces.map((workspace) => {
          const isActive = activeWorkspace === workspace.id
          const isExpanded = expanded === workspace.id

          return (
            <div key={workspace.id} className="relative">
              <button
                onClick={() => {
                  setActiveWorkspace(workspace.id)
                  setExpanded(isExpanded ? null : workspace.id)
                }}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl text-xs font-bold uppercase text-white shadow-lg transition-all',
                  `bg-gradient-to-br ${workspace.color}`,
                  isActive && 'ring-2 ring-white/50 ring-offset-2 ring-offset-slate-900',
                  'hover:scale-110'
                )}
                title={workspace.fullName}
              >
                {workspace.initials}
              </button>

              {isExpanded && (
                <div className="absolute left-full ml-2 z-50 w-64 animate-in fade-in slide-in-from-left-2 rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl backdrop-blur">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold uppercase text-white',
                          `bg-gradient-to-br ${workspace.color}`
                        )}
                      >
                        {workspace.initials}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{workspace.fullName}</p>
                        <p className="text-xs text-slate-400">{workspace.detail}</p>
                      </div>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="text-xs text-slate-400">
                      <p className="font-medium text-white">Active workspace</p>
                      <p className="mt-1">{workspace.detail}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
