/**
 * @registry-id: environmentContext
 * @created: 2026-01-16T16:15:00.000Z
 * @last-modified: 2026-01-16T16:15:00.000Z
 * @description: Environment context provider for active environment tracking
 * @last-fix: [2026-01-16] Added manual environment override with pathname fallback
 */

'use client'

import { createContext, ReactNode, useContext, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { EnvironmentId } from '@/lib/types/environment.types'

interface EnvironmentContextValue {
  activeEnvironment: EnvironmentId
  setActiveEnvironment: (env: EnvironmentId) => void
}

const EnvironmentContext = createContext<EnvironmentContextValue | undefined>(undefined)

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [manualEnvironment, setManualEnvironment] = useState<EnvironmentId | null>(null)

  const derivedEnvironment = useMemo((): EnvironmentId => {
    if (pathname.startsWith('/chats')) return 'chats'
    if (pathname.startsWith('/daily-ops')) return 'daily-ops'
    return 'collaboration'
  }, [pathname])

  // Use manual override if set, otherwise derive from pathname
  const activeEnvironment = manualEnvironment ?? derivedEnvironment

  const setActiveEnvironment = (env: EnvironmentId) => {
    setManualEnvironment(env)
  }

  const value = useMemo(
    () => ({
      activeEnvironment,
      setActiveEnvironment,
    }),
    [activeEnvironment]
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
