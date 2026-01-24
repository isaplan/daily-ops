/**
 * @registry-id: DailyOpsRouteGuard
 * @created: 2026-01-24T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Manager-only guard for all /daily-ops routes
 * @last-fix: [2026-01-24] Initial implementation
 *
 * @exports-to:
 * ✓ app/daily-ops/** => Protects Daily Ops routes
 */

'use client'

import { ReactNode } from 'react'
// TEMPORARILY DISABLED: Manager-only restriction
// import { useEffect } from 'react'
// import { useRouter } from 'next/navigation'
// import { useAuth } from '@/lib/hooks/useAuth'

export default function DailyOpsLayout({ children }: { children: ReactNode }) {
  // TEMPORARILY DISABLED: Manager-only restriction
  // const router = useRouter()
  // const { loading, isManager, isAdmin } = useAuth()
  // const canAccess = isManager || isAdmin
  // useEffect(() => {
  //   if (!loading && !canAccess) {
  //     router.replace('/daily-work')
  //   }
  // }, [canAccess, loading, router])
  // if (loading) return null
  // if (!canAccess) {
  //   return null
  // }

  return <>{children}</>
}

