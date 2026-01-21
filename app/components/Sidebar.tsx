/**
 * @registry-id: SidebarComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-21T00:30:00.000Z
 * @description: Sidebar navigation component using microcomponents (classic-only mode)
 * @last-fix: [2026-01-21] Removed design mode toggle, classic-only navigation
 * 
 * @imports-from:
 *   - app/components/ui/button.tsx => Button microcomponent
 * 
 * @exports-to:
 *   ✓ app/layout.tsx => Uses Sidebar for navigation
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export default function Sidebar() {
  const pathname = usePathname()

  const navItems = [
    { href: '/design', label: 'Design System', icon: '🎨' },
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/notes', label: 'Notes', icon: '📝' },
    { href: '/todos', label: 'Todos', icon: '✓' },
    { href: '/decisions', label: 'Decisions', icon: '🎯' },
    { href: '/channels', label: 'Channels', icon: '💬' },
    { href: '/events', label: 'Events', icon: '📅' },
    { href: '/organization', label: 'Organization', icon: '🏢' },
  ]

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Daily Ops</h1>
        <p className="text-sm text-gray-400">POC</p>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3',
                  isActive && 'bg-blue-600 text-white hover:bg-blue-700',
                  !isActive && 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Button>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
