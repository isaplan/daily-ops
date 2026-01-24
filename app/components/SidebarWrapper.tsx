/**
 * @registry-id: SidebarWrapperComponent
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-22T00:00:00.000Z
 * @description: Client component wrapper that conditionally renders the correct sidebar based on environment
 * @last-fix: [2026-01-22] Initial implementation for environment-based sidebar switching
 * 
 * @imports-from:
 *   - app/components/Sidebar.tsx => AppSidebar for Daily Work environment
 *   - app/components/DailyOpsSidebar.tsx => DailyOpsSidebar for Daily Ops environment
 *   - app/lib/environmentContext.tsx => useEnvironment hook
 * 
 * @exports-to:
 *   ✓ app/layout.tsx => Uses SidebarWrapper to render environment-specific sidebar
 */

'use client'

import { useEnvironment } from '@/lib/environmentContext'
import AppSidebar from './Sidebar'
import DailyOpsSidebar from './DailyOpsSidebar'

export default function SidebarWrapper() {
  const { activeEnvironment } = useEnvironment()

  // Render Daily Ops sidebar for daily-ops environment, otherwise render Daily Work sidebar
  if (activeEnvironment === 'daily-ops') {
    return <DailyOpsSidebar />
  }

  return <AppSidebar />
}
