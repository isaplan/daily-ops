/**
 * @registry-id: DesignV2TopNav
 * @created: 2026-01-16T15:00:00.000Z
 * @last-modified: 2026-01-16T15:00:00.000Z
 * @description: Top navigation bar for Design V2 with environment switcher
 * @last-fix: [2026-01-16] Initial V2 top nav implementation
 * 
 * @imports-from:
 *   - app/components/ui/button.tsx => Button component
 *   - app/components/ui/badge.tsx => Badge component
 * 
 * @exports-to:
 *   ✓ app/components/layouts/DesignV2Layout.tsx => Top navigation bar
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

const environments = [
  {
    id: 'collaboration',
    label: 'Collaboration',
    accent: 'from-indigo-500/80 via-blue-600 to-slate-900/70',
  },
  {
    id: 'chats',
    label: 'Chats',
    accent: 'from-amber-500/80 via-orange-500 to-rose-900/70',
  },
  {
    id: 'daily-ops',
    label: 'Daily Ops',
    accent: 'from-cyan-500/80 via-teal-600 to-slate-900/80',
  },
]

export default function DesignV2TopNav() {
  const [activeEnv, setActiveEnv] = useState(environments[0].id)

  const activeEnvironment = environments.find((e) => e.id === activeEnv) ?? environments[0]

  return (
    <header className="border-b border-white/10 bg-slate-900/90 px-6 py-4 backdrop-blur shadow-lg shadow-black/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {environments.map((env) => {
              const isActive = env.id === activeEnv
              return (
                <button
                  key={env.id}
                  onClick={() => setActiveEnv(env.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all',
                    isActive
                      ? `bg-gradient-to-r ${env.accent} text-white shadow-lg shadow-black/60`
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                  {env.label}
                </button>
              )
            })}
          </div>
          <Badge variant="outline" className="text-xs uppercase tracking-tight">
            {activeEnvironment.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
            Search
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
            Notifications
          </Button>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500" />
        </div>
      </div>
    </header>
  )
}
