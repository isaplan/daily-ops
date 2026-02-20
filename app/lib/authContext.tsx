/**
 * @registry-id: authContext
 * @created: 2026-02-14T00:00:00.000Z
 * @last-modified: 2026-02-14T00:00:00.000Z
 * @description: Single shared auth state so /api/auth/me is called once per app load
 * @last-fix: [2026-02-14] Initial provider to fix duplicate auth requests and slow loads
 *
 * @exports-to:
 *   ✓ app/LayoutClients.tsx => AuthProvider wraps app
 *   ✓ app/lib/hooks/useAuth.ts => useAuth consumes context
 */

'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'member' | 'manager' | 'admin'
  location_id?: string
  team_id?: string
}

type AuthState = {
  user: AuthUser | null
  loading: boolean
  error: string | null
}

const defaultState: AuthState = {
  user: null,
  loading: true,
  error: null,
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultState)

  useEffect(() => {
    let cancelled = false
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' })
        if (cancelled) return
        if (response.status === 401) {
          setState({ user: null, loading: false, error: null })
          return
        }
        if (!response.ok) {
          setState({ user: null, loading: false, error: 'Not authenticated' })
          return
        }
        const user = await response.json()
        if (!cancelled) setState({ user, loading: false, error: null })
      } catch {
        if (!cancelled) setState({ user: null, loading: false, error: null })
      }
    }
    fetchUser()
    return () => { cancelled = true }
  }, [])

  const value = useMemo(() => state, [state.user, state.loading, state.error])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  return useContext(AuthContext)
}
