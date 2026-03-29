/**
 * @registry-id: DesignV2Layout
 * @created: 2026-01-16T15:00:00.000Z
 * @last-modified: 2026-01-16T15:00:00.000Z
 * @description: Design V2 layout with workspace switcher, top nav, and modern sidebar
 * @last-fix: [2026-01-16] Initial V2 layout implementation
 * 
 * @imports-from:
 *   - app/lib/designMode.tsx => Design mode context
 *   - app/components/layouts/DesignV2Sidebar.tsx => V2 sidebar
 *   - app/components/layouts/DesignV2TopNav.tsx => V2 top navigation
 *   - app/components/layouts/DesignV2WorkspaceSwitcher.tsx => Workspace switcher
 * 
 * @exports-to:
 *   ✓ app/layout.tsx => Conditionally renders V2 layout
 */

'use client'

import { ReactNode } from 'react'
import { useDesignMode } from '@/lib/designMode'
import DesignV2Sidebar from './DesignV2Sidebar'
import DesignV2TopNav from './DesignV2TopNav'
import DesignV2WorkspaceSwitcher from './DesignV2WorkspaceSwitcher'

interface DesignV2LayoutProps {
  children: ReactNode
}

export default function DesignV2Layout({ children }: DesignV2LayoutProps) {
  const { mode } = useDesignMode()

  if (mode !== 'v2') {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-950 text-white">
      <DesignV2WorkspaceSwitcher />
      <DesignV2Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DesignV2TopNav />
        <main className="flex-1 overflow-y-auto bg-slate-950/50 p-6 backdrop-blur">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
