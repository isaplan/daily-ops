/**
 * @registry-id: environmentContext
 * @created: 2026-01-16T16:15:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Environment context provider for active environment tracking
 * @last-fix: [2026-01-24] Updated to daily-work and daily-ops routes
 */

'use client'

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { EnvironmentId } from '@/lib/types/environment.types'

interface EnvironmentContextValue {
  activeEnvironment: EnvironmentId
  setActiveEnvironment: (env: EnvironmentId) => void
  getEnvironmentLabel: (env: EnvironmentId) => string
}

const EnvironmentContext = createContext<EnvironmentContextValue | undefined>(undefined)

const environmentLabels: Record<EnvironmentId, string> = {
  'daily-work': 'Daily Work',
  'daily-ops': 'Daily Ops',
}

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [manualEnvironment, setManualEnvironment] = useState<EnvironmentId | null>(null)

  const derivedEnvironment = useMemo((): EnvironmentId => {
    if (pathname.startsWith('/daily-ops')) return 'daily-ops'
    return 'daily-work'
  }, [pathname])

  // Use manual override if set, otherwise derive from pathname
  const activeEnvironment = manualEnvironment ?? derivedEnvironment

  const setActiveEnvironment = useCallback((env: EnvironmentId) => {
    setManualEnvironment(env)
    // Navigate to the appropriate base route when switching environments
    if (env === 'daily-ops' && !pathname.startsWith('/daily-ops')) router.push('/daily-ops')
    if (env === 'daily-work' && !pathname.startsWith('/daily-work')) router.push('/daily-work')
  }, [pathname, router])

  const getEnvironmentLabel = useCallback((env: EnvironmentId) => environmentLabels[env] || env, [])

  const value = useMemo(
    () => ({
      activeEnvironment,
      setActiveEnvironment,
      getEnvironmentLabel,
    }),
    [activeEnvironment, getEnvironmentLabel, setActiveEnvironment]
  )

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext)
  if (!context) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider')
  }
  return context
}
