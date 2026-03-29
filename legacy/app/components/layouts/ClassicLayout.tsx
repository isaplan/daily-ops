/**
 * @registry-id: ClassicLayout
 * @created: 2026-01-16T15:00:00.000Z
 * @last-modified: 2026-01-21T00:30:00.000Z
 * @description: Classic layout with traditional sidebar (V2 removed, classic-only mode)
 * @last-fix: [2026-01-21] Removed design mode dependency, simplified to classic-only
 * 
 * @imports-from:
 *   - app/components/Sidebar.tsx => Classic sidebar
 * 
 * @exports-to:
 *   ✓ app/layout.tsx => Uses classic layout directly (no longer needed, kept for reference)
 */

'use client'

import { ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'

interface ClassicLayoutProps {
  children: ReactNode
}

export default function ClassicLayout({ children }: ClassicLayoutProps) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
