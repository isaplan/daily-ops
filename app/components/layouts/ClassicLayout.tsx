/**
 * @registry-id: ClassicLayout
 * @created: 2026-01-16T15:00:00.000Z
 * @last-modified: 2026-01-16T15:00:00.000Z
 * @description: Classic V1 layout with traditional sidebar
 * @last-fix: [2026-01-16] Initial classic layout wrapper
 * 
 * @imports-from:
 *   - app/components/Sidebar.tsx => Classic sidebar
 * 
 * @exports-to:
 *   ✓ app/layout.tsx => Conditionally renders classic layout
 */

'use client'

import { ReactNode } from 'react'
import { useDesignMode } from '@/lib/designMode'
import Sidebar from '@/components/Sidebar'

interface ClassicLayoutProps {
  children: ReactNode
}

export default function ClassicLayout({ children }: ClassicLayoutProps) {
  const { mode } = useDesignMode()

  if (mode !== 'v1') {
    return null
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
