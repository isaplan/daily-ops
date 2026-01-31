/**
 * @registry-id: DailyOpsSidebarComponent
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Sidebar navigation component for Daily Ops environment with collapsible Hours and Inbox menus
 * @last-fix: [2026-01-28] Added nested collapsible dropdowns per inbox group type (General, Eitje, Bork, Power-BI, Other)
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
import { LayoutDashboard, Settings, Clock, ChevronRight, Mail } from 'lucide-react'
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
  { href: '/daily-ops/settings/bork-api', label: 'Bork API', icon: Settings },
]

// Hours submenu items
const hoursSubItems = [
  { href: '/daily-ops/hours', label: 'Day & Location' },
  { href: '/daily-ops/hours/by-day', label: 'By Day' },
  { href: '/daily-ops/hours/by-worker', label: 'By Worker' },
  { href: '/daily-ops/hours/by-team', label: 'By Team' },
  { href: '/daily-ops/hours/by-location', label: 'By Location' },
]

// Inbox submenu items organized by source
interface InboxSubItem {
  href: string
  label: string
  group: string
}

const inboxSubItems: InboxSubItem[] = [
  // General
  { href: '/daily-ops/inbox', label: 'Overview', group: 'general' },
  { href: '/daily-ops/inbox/emails', label: 'Emails', group: 'general' },
  { href: '/daily-ops/inbox/upload', label: 'Upload', group: 'general' },
  
  // Eitje
  { href: '/daily-ops/inbox/eitje', label: 'Eitje', group: 'eitje' },
  { href: '/daily-ops/inbox/eitje/hours', label: 'Hours', group: 'eitje' },
  { href: '/daily-ops/inbox/eitje/contracts', label: 'Contracts', group: 'eitje' },
  { href: '/daily-ops/inbox/eitje/finance', label: 'Finance', group: 'eitje' },
  
  // Bork (Trivec)
  { href: '/daily-ops/inbox/bork', label: 'Bork', group: 'bork' },
  { href: '/daily-ops/inbox/bork/sales', label: 'Sales', group: 'bork' },
  { href: '/daily-ops/inbox/bork/product-mix', label: 'Product Mix', group: 'bork' },
  { href: '/daily-ops/inbox/bork/food-beverage', label: 'Food & Beverage', group: 'bork' },
  { href: '/daily-ops/inbox/bork/basis-report', label: 'Basis Report', group: 'bork' },
  { href: '/daily-ops/inbox/bork/sales-per-hour', label: 'Sales Per Hour', group: 'bork' },
  
  // Power-BI
  { href: '/daily-ops/inbox/power-bi', label: 'Power-BI', group: 'power-bi' },
  { href: '/daily-ops/inbox/power-bi/reports', label: 'Reports', group: 'power-bi' },
  
  // Other
  { href: '/daily-ops/inbox/other', label: 'Other', group: 'other' },
  { href: '/daily-ops/inbox/other/all-test-data', label: 'All Test Data', group: 'other' },
]

// Group inbox items by source (order matters)
const inboxGroups = [
  { id: 'general', label: 'General' },
  { id: 'eitje', label: 'Eitje' },
  { id: 'bork', label: 'Bork (Trivec)' },
  { id: 'power-bi', label: 'Power-BI' },
  { id: 'other', label: 'Other' },
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
  
  // Check if we're on any inbox page to determine if inbox menu should be open
  const isInboxPage = pathname?.startsWith('/daily-ops/inbox')
  const [isInboxOpen, setIsInboxOpen] = React.useState(isInboxPage)
  
  // Track which inbox group dropdowns are open
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})
  
  // Determine which group should be open based on current pathname
  React.useEffect(() => {
    if (isInboxPage) {
      const currentGroup = inboxGroups.find((group) => {
        const groupItems = inboxSubItems.filter((item) => item.group === group.id)
        return groupItems.some((item) => {
          if (pathname === item.href) return true
          if (pathname?.startsWith(item.href + '/')) return true
          return false
        })
      })
      
      if (currentGroup) {
        setOpenGroups((prev) => ({ ...prev, [currentGroup.id]: true }))
      }
    }
  }, [isInboxPage, pathname])
  
  // Update isHoursOpen when pathname changes
  React.useEffect(() => {
    setIsHoursOpen(isHoursPage)
  }, [isHoursPage])
  
  // Update isInboxOpen when pathname changes
  React.useEffect(() => {
    setIsInboxOpen(isInboxPage)
  }, [isInboxPage])
  
  // Toggle group dropdown
  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

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
              
              {/* Inbox collapsible menu */}
              <Collapsible asChild open={isInboxOpen} onOpenChange={setIsInboxOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Inbox" isActive={isInboxPage}>
                      <Mail />
                      <span>Inbox</span>
                      <ChevronRight className={`ml-auto transition-transform duration-200 ${isInboxOpen ? 'rotate-90' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {inboxGroups.map((group) => {
                        const groupItems = inboxSubItems.filter((item) => item.group === group.id)
                        if (groupItems.length === 0) return null
                        
                        const isGroupOpen = openGroups[group.id] ?? false
                        const hasActiveItem = groupItems.some((item) => {
                          if (pathname === item.href) return true
                          // Check if pathname starts with the item href (for nested routes)
                          if (pathname?.startsWith(item.href + '/')) return true
                          return false
                        })
                        
                        // General group - no dropdown, show items directly
                        if (group.id === 'general') {
                          return (
                            <React.Fragment key={group.id}>
                              {groupItems.map((subItem) => {
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
                            </React.Fragment>
                          )
                        }
                        
                        // Other groups - collapsible dropdown
                        return (
                          <Collapsible
                            key={group.id}
                            open={isGroupOpen}
                            onOpenChange={() => toggleGroup(group.id)}
                          >
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={hasActiveItem}>
                                  <span className="font-medium">{group.label}</span>
                                  <ChevronRight className={`ml-auto h-4 w-4 transition-transform duration-200 ${isGroupOpen ? 'rotate-90' : ''}`} />
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {groupItems.map((subItem) => {
                                    // Check if active - exact match or nested route
                                    const isSubActive = pathname === subItem.href || pathname?.startsWith(subItem.href + '/')
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
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              
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
