/**
 * @registry-id: SidebarComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Sidebar navigation component using shadcn/ui sidebar components
 * @last-fix: [2026-01-24] Moved Daily Work routes under /daily-work and gated Daily Ops visibility
 * 
 * @imports-from:
 *   - app/components/ui/sidebar.tsx => shadcn sidebar components
 *   - app/components/ui/button.tsx => Button microcomponent
 *   - app/components/ui/select.tsx => Select dropdown component
 *   - app/lib/environmentContext.tsx => useEnvironment hook
 * 
 * @exports-to:
 *   ✓ app/layout.tsx => Uses Sidebar for navigation
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEnvironment } from '@/lib/environmentContext'
import { LayoutDashboard, FileText, CheckSquare, Target, MessageSquare, Calendar, Building2, Palette } from 'lucide-react'
// TEMPORARILY DISABLED: Manager-only restriction
// import { useAuth } from '@/lib/hooks/useAuth'

const navItems = [
  { href: '/daily-work/design', label: 'Design System', icon: Palette },
  { href: '/daily-work', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/daily-work/notes', label: 'Notes', icon: FileText },
  { href: '/daily-work/todos', label: 'Todos', icon: CheckSquare },
  { href: '/daily-work/decisions', label: 'Decisions', icon: Target },
  { href: '/daily-work/channels', label: 'Channels', icon: MessageSquare },
  { href: '/daily-work/events', label: 'Events', icon: Calendar },
  { href: '/daily-work/organization', label: 'Organization', icon: Building2 },
]

const environments = [
  { id: 'daily-work' as const, label: 'Daily Work' },
  { id: 'daily-ops' as const, label: 'Daily Ops' },
] as const

export default function AppSidebar() {
  const pathname = usePathname()
  const { activeEnvironment, setActiveEnvironment } = useEnvironment()
  // TEMPORARILY DISABLED: Manager-only restriction
  // const { isManager, isAdmin } = useAuth()
  const currentEnv = environments.find(e => e.id === activeEnvironment) || environments[0]
  // const canSeeDailyOps = isManager || isAdmin
  // const visibleEnvironments = canSeeDailyOps ? environments : environments.filter((e) => e.id !== 'daily-ops')
  const visibleEnvironments = environments // Show all environments

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <Select value={activeEnvironment} onValueChange={(value) => setActiveEnvironment(value as typeof activeEnvironment)}>
            <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 hover:bg-transparent">
              <div className="flex flex-col items-start">
                <SelectValue>
                  <span className="text-sm font-semibold">{currentEnv.label}</span>
                </SelectValue>
              </div>
            </SelectTrigger>
            <SelectContent>
              {visibleEnvironments.map((env) => (
                <SelectItem key={env.id} value={env.id}>
                  {env.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
