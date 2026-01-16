/**
 * @registry-id: designModeContext
 * @created: 2026-01-16T14:45:00.000Z
 * @last-modified: 2026-01-16T14:45:00.000Z
 * @description: Provides a design mode toggle (Classic vs Design V2) for the navigation experience.
 * @last-fix: [2026-01-16] Added provider to persist the selected design version
 *
 * @exports-to:
 *   ✓ app/layout.tsx => Wraps the layout so all children know the active mode
 *   ✓ app/components/Sidebar.tsx => Uses the toggle control
 *   ✓ app/design/page.tsx => Shows a V2 badge when the mode is active
 */

'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

const DESIGN_MODE_STORAGE_KEY = 'design-mode'
export type DesignMode = 'v1' | 'v2'

interface DesignModeContextValue {
  mode: DesignMode
  setMode: (mode: DesignMode) => void
  toggleMode: () => void
}

const DesignModeContext = createContext<DesignModeContextValue | undefined>(undefined)

export function DesignModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DesignMode>('v1')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(DESIGN_MODE_STORAGE_KEY) as DesignMode | null
    if (stored === 'v2') {
      setMode('v2')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DESIGN_MODE_STORAGE_KEY, mode)
  }, [mode])

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((current) => (current === 'v1' ? 'v2' : 'v1')),
    }),
    [mode]
  )

  return <DesignModeContext.Provider value={value}>{children}</DesignModeContext.Provider>
}

export function useDesignMode() {
  const context = useContext(DesignModeContext)
  if (!context) {
    throw new Error('useDesignMode must be used within a DesignModeProvider')
  }
  return context
}
