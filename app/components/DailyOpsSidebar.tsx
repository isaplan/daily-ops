/**
 * @registry-id: DailyOpsSidebarComponent
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-25T00:00:00.000Z
 * @description: Sidebar navigation component for Daily Ops environment with collapsible Hours menu
 * @last-fix: [2026-01-25] Added collapsible Hours dropdown with child pages (by-day, by-worker, by-team, by-location)
 * 
 * @imports-from:
 *   - app/components/ui/sidebar.tsx => shadcn sidebar components
 *   - app/components/ui/select.tsx => Select dropdown component
 *   - app/components/ui/collapsible.tsx => Collapsible component for dropdown menu
 *   - app/lib/environmentContext.tsx => useEnvironment hook
 * 
 * @exports-to:
 *   ✓ app/layout.tsx => Uses DailyOpsSidebar for Daily Ops environment navigation
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEnvironment } from '@/lib/environmentContext'
import { LayoutDashboard, Settings, Clock, ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
// TEMPORARILY DISABLED: Manager-only restriction
// import { useAuth } from '@/lib/hooks/useAuth'

const environments = [
  { id: 'daily-work' as const, label: 'Daily Work' },
  { id: 'daily-ops' as const, label: 'Daily Ops' },
] as const

// Navigation items for Daily Ops environment - to be expanded
const navItems = [
  { href: '/daily-ops', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/daily-ops/settings/eitje-api', label: 'Eitje API', icon: Settings },
  // Add more navigation items here as Daily Ops pages are built
]

// Hours submenu items
const hoursSubItems = [
  { href: '/daily-ops/hours', label: 'Day & Location' },
  { href: '/daily-ops/hours/by-day', label: 'By Day' },
  { href: '/daily-ops/hours/by-worker', label: 'By Worker' },
  { href: '/daily-ops/hours/by-team', label: 'By Team' },
  { href: '/daily-ops/hours/by-location', label: 'By Location' },
]

export default function DailyOpsSidebar() {
  const pathname = usePathname()
  const { activeEnvironment, setActiveEnvironment } = useEnvironment()
  // TEMPORARILY DISABLED: Manager-only restriction
  // const { isManager, isAdmin } = useAuth()
  const currentEnv = environments.find(e => e.id === activeEnvironment) || environments[0]
  // const canSeeDailyOps = isManager || isAdmin
  // const visibleEnvironments = canSeeDailyOps ? environments : environments.filter((e) => e.id !== 'daily-ops')
  const visibleEnvironments = environments // Show all environments
  
  // Check if we're on any hours page to determine if hours menu should be open
  const isHoursPage = pathname?.startsWith('/daily-ops/hours')
  const [isHoursOpen, setIsHoursOpen] = React.useState(isHoursPage)
  
  // Update isHoursOpen when pathname changes
  React.useEffect(() => {
    setIsHoursOpen(isHoursPage)
  }, [isHoursPage])

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
              
              {/* Hours collapsible menu */}
              <Collapsible asChild open={isHoursOpen} onOpenChange={setIsHoursOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Hours" isActive={isHoursPage}>
                      <Clock />
                      <span>Hours</span>
                      <ChevronRight className={`ml-auto transition-transform duration-200 ${isHoursOpen ? 'rotate-90' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {hoursSubItems.map((subItem) => {
                        const isSubActive = pathname === subItem.href
                        return (
                          <SidebarMenuSubItem key={subItem.href}>
                            <SidebarMenuSubButton asChild isActive={isSubActive}>
                              <Link href={subItem.href}>
                                <span>{subItem.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
