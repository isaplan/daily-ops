/**
 * @registry-id: AuthGateComponent
 * @created: 2026-01-24T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Root auth gate that blocks the app UI when unauthenticated
 * @last-fix: [2026-01-24] Removed refresh loop on unauthenticated state
 *
 * @exports-to:
 * ✓ app/layout.tsx => Wraps the application shell
 */

'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

export default function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <div className="text-lg font-semibold">Authentication required</div>
          <div className="text-sm text-muted-foreground">
            Please sign in to access Daily Work and Daily Ops.
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

