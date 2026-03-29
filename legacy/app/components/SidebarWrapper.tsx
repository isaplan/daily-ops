/**
 * @registry-id: SidebarWrapperComponent
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Client component wrapper that conditionally renders the correct sidebar based on environment
 * @last-fix: [2026-01-24] Enforced manager-only access to Daily Ops sidebar
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
// TEMPORARILY DISABLED: Manager-only restriction
// import { useAuth } from '@/lib/hooks/useAuth'
import AppSidebar from './Sidebar'
import DailyOpsSidebar from './DailyOpsSidebar'

export default function SidebarWrapper() {
  const { activeEnvironment, setActiveEnvironment } = useEnvironment()
  // TEMPORARILY DISABLED: Manager-only restriction
  // const { isManager, isAdmin, loading } = useAuth()
  // const canSeeDailyOps = isManager || isAdmin
  // if (!loading && activeEnvironment === 'daily-ops' && !canSeeDailyOps) {
  //   setActiveEnvironment('daily-work')
  //   return <AppSidebar />
  // }
  // if (activeEnvironment === 'daily-ops' && canSeeDailyOps) {
  //   return <DailyOpsSidebar />
  // }

  // Render Daily Ops sidebar for daily-ops environment, otherwise render Daily Work sidebar
  if (activeEnvironment === 'daily-ops') {
    return <DailyOpsSidebar />
  }

  return <AppSidebar />
}
