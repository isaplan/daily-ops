/**
 * @registry-id: SidebarComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-22T00:00:00.000Z
 * @description: Sidebar navigation component using shadcn/ui sidebar components
 * @last-fix: [2026-01-22] Migrated to shadcn/ui sidebar solution with collapsible support
 * 
 * @imports-from:
 *   - app/components/ui/sidebar.tsx => shadcn sidebar components
 *   - app/components/ui/button.tsx => Button microcomponent
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
import { LayoutDashboard, FileText, CheckSquare, Target, MessageSquare, Calendar, Building2, Palette } from 'lucide-react'

const navItems = [
  { href: '/design', label: 'Design System', icon: Palette },
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/todos', label: 'Todos', icon: CheckSquare },
  { href: '/decisions', label: 'Decisions', icon: Target },
  { href: '/channels', label: 'Channels', icon: MessageSquare },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/organization', label: 'Organization', icon: Building2 },
]

export default function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Daily Ops</span>
            <span className="text-xs text-muted-foreground">POC</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href
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
