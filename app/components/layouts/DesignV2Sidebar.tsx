/**
 * @registry-id: DesignV2Sidebar
 * @created: 2026-01-16T15:00:00.000Z
 * @last-modified: 2026-01-16T15:00:00.000Z
 * @description: Modern sidebar for Design V2 with environment sections
 * @last-fix: [2026-01-16] Initial V2 sidebar implementation
 * 
 * @imports-from:
 *   - app/components/ui/button.tsx => Button component
 *   - app/lib/designMode.tsx => Design mode context
 * 
 * @exports-to:
 *   ✓ app/components/layouts/DesignV2Layout.tsx => Sidebar navigation
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useDesignMode } from '@/lib/designMode'

const environmentSections = {
  collaboration: {
    label: 'Collaboration',
    items: [
      { href: '/collaboration', label: 'Dashboard', icon: '📊' },
      { href: '/notes', label: 'Notes', icon: '📝' },
      { href: '/todos', label: 'Todos', icon: '✓' },
      { href: '/decisions', label: 'Decisions', icon: '🎯' },
      { href: '/events', label: 'Events', icon: '📅' },
    ],
  },
  chats: {
    label: 'Chats',
    items: [
      { href: '/chats', label: 'Chats', icon: '💬' },
      { href: '/channels', label: 'Channels', icon: '📢' },
    ],
  },
  'daily-ops': {
    label: 'Daily Ops',
    items: [{ href: '/organization', label: 'Organization', icon: '🏢' }],
  },
}

export default function DesignV2Sidebar() {
  const pathname = usePathname()
  const { mode, setMode } = useDesignMode()

  const modeOptions = [
    { id: 'v1', label: 'Classic' },
    { id: 'v2', label: 'Design V2' },
  ]

  return (
    <aside className="w-64 border-r border-white/10 bg-slate-900/80 p-4 backdrop-blur">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">Daily Ops</h1>
        <p className="text-xs uppercase tracking-tight text-slate-400">POC</p>
      </div>

      <div className="mb-6 flex gap-2">
        {modeOptions.map((option) => (
          <Button
            key={option.id}
            variant={mode === option.id ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 text-xs uppercase tracking-tight"
            onClick={() => setMode(option.id as 'v1' | 'v2')}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="space-y-6">
        {Object.entries(environmentSections).map(([key, section]) => (
          <div key={key}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-tight text-slate-500">
              {section.label}
            </p>
            <nav className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start gap-3 text-sm',
                        isActive
                          ? 'bg-gradient-to-r from-indigo-500/20 to-blue-500/20 text-white'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                    </Button>
                  </Link>
                )
              })}
            </nav>
          </div>
        ))}

        <div className="pt-4">
          <Link href="/design">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 text-sm',
                pathname === '/design'
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <span className="text-lg">🎨</span>
              <span className="font-medium">Design System</span>
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  )
}
