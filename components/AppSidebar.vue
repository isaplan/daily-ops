<template>
  <aside
    class="shrink-0 border-r border-gray-200 bg-white flex flex-col h-full z-10 transition-[width] duration-200 ease-linear w-16 min-w-16 max-w-16"
    :class="{ '!w-48 !min-w-48 !max-w-48': !collapsed }"
  >
    <!-- Header: collapsed = initials in black box; open = dashboard icon + full env name -->
    <div
      class="flex items-center border-b border-gray-200 shrink-0 gap-2 px-4 py-3"
      :class="collapsed ? 'justify-center px-0' : ''"
    >
      <UTooltip
        v-if="collapsed"
        :text="`${getEnvironmentLabel(activeEnvironment)} – click to change`"
        :popper="{ placement: 'right' }"
      >
        <UDropdownMenu :items="envDropdownItems" :popper="{ placement: 'bottom-start' }">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center justify-center rounded-md outline-none ring-gray-300 focus:ring-2"
            :class="collapsed ? 'p-0' : ''"
            :aria-label="`Environment: ${getEnvironmentLabel(activeEnvironment)}. Click to change.`"
          >
            <!-- Collapsed: black box with initials only -->
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-xs font-semibold uppercase tracking-wide text-white">
              {{ environmentInitials }}
            </div>
          </button>
        </UDropdownMenu>
      </UTooltip>
      <UDropdownMenu v-else :items="envDropdownItems" :popper="{ placement: 'bottom-start' }">
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-md outline-none ring-gray-300 focus:ring-2"
          :aria-label="`Environment: ${getEnvironmentLabel(activeEnvironment)}. Click to change.`"
        >
          <!-- Open: black dashboard icon + full environment name + down chevron -->
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
            <UIcon name="i-lucide-layout-dashboard" class="size-4" />
          </div>
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
            {{ getEnvironmentLabel(activeEnvironment) }}
          </span>
          <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-gray-500" />
        </button>
      </UDropdownMenu>
    </div>

    <nav class="flex-1 p-2 overflow-y-auto" :class="collapsed ? 'px-2' : 'p-4'">
      <p v-if="!collapsed" class="mb-2 text-xs font-semibold uppercase tracking-tight text-gray-500">
        Navigation
      </p>
      <!-- Daily Ops environment: Dashboard, Settings, Hours, Inbox -->
      <ul v-if="activeEnvironment === 'daily-ops'" class="space-y-1">
        <li>
          <UTooltip v-if="collapsed" text="Dashboard" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-ops" :class="navLinkClass(isDailyOpsDashboard)">
              <UIcon name="i-lucide-layout-dashboard" class="size-5 shrink-0" />
              <span v-if="!collapsed">Dashboard</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-ops" :class="navLinkClass(isDailyOpsDashboard)">
            <UIcon name="i-lucide-layout-dashboard" class="size-4 shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="Dashboard V2" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-ops-v2" :class="navLinkClass(isDailyOpsV2Dashboard)">
              <UIcon name="i-lucide-layout-panel-top" class="size-5 shrink-0" />
              <span v-if="!collapsed">Dashboard V2</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-ops-v2" :class="navLinkClass(isDailyOpsV2Dashboard)">
            <UIcon name="i-lucide-layout-panel-top" class="size-4 shrink-0" />
            <span>Dashboard V2</span>
          </NuxtLink>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="Dashboard V3" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-ops-v3" :class="navLinkClass(isDailyOpsV3Dashboard)">
              <UIcon name="i-lucide-sparkles" class="size-5 shrink-0" />
              <span v-if="!collapsed">Dashboard V3</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-ops-v3" :class="navLinkClass(isDailyOpsV3Dashboard)">
            <UIcon name="i-lucide-sparkles" class="size-4 shrink-0" />
            <span>Dashboard V3</span>
          </NuxtLink>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="Workers" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-ops/workers" :class="navLinkClass(isWorkersPage)">
              <UIcon name="i-lucide-users" class="size-5 shrink-0" />
              <span v-if="!collapsed">Workers</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-ops/workers" :class="navLinkClass(isWorkersPage)">
            <UIcon name="i-lucide-users" class="size-4 shrink-0" />
            <span>Workers</span>
          </NuxtLink>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="Eitje API" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-ops/settings/eitje-api" :class="navLinkClass(isEitjeApi)">
              <UIcon name="i-lucide-settings" class="size-5 shrink-0" />
              <span v-if="!collapsed">Eitje API</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-ops/settings/eitje-api" :class="navLinkClass(isEitjeApi)">
            <UIcon name="i-lucide-settings" class="size-4 shrink-0" />
            <span>Eitje API</span>
          </NuxtLink>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="Bork API" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-ops/settings/bork-api" :class="navLinkClass(isBorkApi)">
              <UIcon name="i-lucide-settings" class="size-5 shrink-0" />
              <span v-if="!collapsed">Bork API</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-ops/settings/bork-api" :class="navLinkClass(isBorkApi)">
            <UIcon name="i-lucide-settings" class="size-4 shrink-0" />
            <span>Bork API</span>
          </NuxtLink>
        </li>
        <!-- Hours (collapsible) -->
        <li>
          <UTooltip v-if="collapsed" text="Hours" :popper="{ placement: 'right' }">
            <UDropdownMenu :items="hoursDropdownItems" :popper="{ placement: 'right-start' }">
              <button
                type="button"
                :class="navLinkClass(isHoursSection)"
                class="w-full flex items-center"
              >
                <UIcon name="i-lucide-clock" class="size-5 shrink-0" />
              </button>
            </UDropdownMenu>
          </UTooltip>
          <button v-else
            type="button"
            :class="navLinkClass(isHoursSection)"
            class="w-full flex items-center"
            @click="isHoursOpen = !isHoursOpen"
          >
            <UIcon name="i-lucide-clock" class="size-4 shrink-0" />
            <span class="flex-1 text-left">Hours</span>
            <UIcon name="i-lucide-chevron-right" :class="['size-4 shrink-0 transition-transform', isHoursOpen && 'rotate-90']" />
          </button>
          <ul v-if="!collapsed && isHoursOpen" class="mt-1 ml-4 space-y-0.5 border-l border-gray-200 pl-3">
            <li><NuxtLink to="/daily-ops/hours" :class="navLinkClass(route.path === '/daily-ops/hours')">Day & Location</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/hours/by-day" :class="navLinkClass(route.path === '/daily-ops/hours/by-day')">By Day</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/hours/by-team" :class="navLinkClass(route.path === '/daily-ops/hours/by-team')">By Team</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/hours/by-location" :class="navLinkClass(route.path === '/daily-ops/hours/by-location')">By Location</NuxtLink></li>
          </ul>
        </li>
        <!-- Hours V3 (collapsible) -->
        <li>
          <UTooltip v-if="collapsed" text="Hours V3" :popper="{ placement: 'right' }">
            <UDropdownMenu :items="hoursV3DropdownItems" :popper="{ placement: 'right-start' }">
              <button
                type="button"
                :class="navLinkClass(isHoursV3Section)"
                class="w-full flex items-center"
              >
                <UIcon name="i-lucide-zap" class="size-5 shrink-0" />
              </button>
            </UDropdownMenu>
          </UTooltip>
          <button v-else
            type="button"
            :class="navLinkClass(isHoursV3Section)"
            class="w-full flex items-center"
            @click="isHoursV3Open = !isHoursV3Open"
          >
            <UIcon name="i-lucide-zap" class="size-4 shrink-0" />
            <span class="flex-1 text-left">Hours V3</span>
            <UIcon name="i-lucide-chevron-right" :class="['size-4 shrink-0 transition-transform', isHoursV3Open && 'rotate-90']" />
          </button>
          <ul v-if="!collapsed && isHoursV3Open" class="mt-1 ml-4 space-y-0.5 border-l border-gray-200 pl-3">
            <li><NuxtLink to="/daily-ops-v3/hours" :class="navLinkClass(route.path === '/daily-ops-v3/hours')">Overview</NuxtLink></li>
            <li><NuxtLink to="/daily-ops-v3/hours/by-day" :class="navLinkClass(route.path === '/daily-ops-v3/hours/by-day')">By Day</NuxtLink></li>
            <li><NuxtLink to="/daily-ops-v3/hours/by-hour" :class="navLinkClass(route.path === '/daily-ops-v3/hours/by-hour')">By Hour</NuxtLink></li>
            <li><NuxtLink to="/daily-ops-v3/hours/by-team" :class="navLinkClass(route.path === '/daily-ops-v3/hours/by-team')">By Team</NuxtLink></li>
            <li><NuxtLink to="/daily-ops-v3/hours/by-contract" :class="navLinkClass(route.path === '/daily-ops-v3/hours/by-contract')">By Contract</NuxtLink></li>
          </ul>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="Sales" :popper="{ placement: 'right' }">
            <UDropdownMenu :items="salesDropdownItems" :popper="{ placement: 'right-start' }">
              <button
                type="button"
                :class="navLinkClass(isSalesSection)"
                class="w-full flex items-center"
              >
                <UIcon name="i-lucide-shopping-cart" class="size-5 shrink-0" />
              </button>
            </UDropdownMenu>
          </UTooltip>
          <button v-else
            type="button"
            :class="navLinkClass(isSalesSection)"
            class="w-full flex items-center"
            @click="isSalesOpen = !isSalesOpen"
          >
            <UIcon name="i-lucide-shopping-cart" class="size-4 shrink-0" />
            <span class="flex-1 text-left">Sales</span>
            <UIcon name="i-lucide-chevron-right" :class="['size-4 shrink-0 transition-transform', isSalesOpen && 'rotate-90']" />
          </button>
          <ul v-if="!collapsed && isSalesOpen" class="mt-1 ml-4 space-y-0.5 border-l border-gray-200 pl-3">
            <li><NuxtLink to="/daily-ops/sales" :class="navLinkClass(route.path === '/daily-ops/sales')">Overview</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales/by-hour" :class="navLinkClass(route.path === '/daily-ops/sales/by-hour')">By Hour</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales/by-table" :class="navLinkClass(route.path === '/daily-ops/sales/by-table')">By Table</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales/by-worker" :class="navLinkClass(route.path === '/daily-ops/sales/by-worker')">By Worker</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales/by-product" :class="navLinkClass(route.path === '/daily-ops/sales/by-product')">By Product</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales/by-guest-account" :class="navLinkClass(route.path === '/daily-ops/sales/by-guest-account')">By Guest Account</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales/day-breakdown" :class="navLinkClass(route.path === '/daily-ops/sales/day-breakdown')">Day Breakdown</NuxtLink></li>
          </ul>
        </li>
        <!-- Sales-V2 (register business-day aggregates; same collapsed dropdown pattern as Hours) -->
        <li>
          <UTooltip v-if="collapsed" text="Sales-V2" :popper="{ placement: 'right' }">
            <UDropdownMenu :items="salesV2DropdownItems" :popper="{ placement: 'right-start' }">
              <button
                type="button"
                :class="navLinkClass(isSalesV2Section)"
                class="w-full flex items-center"
              >
                <UIcon name="i-lucide-chart-column" class="size-5 shrink-0" />
              </button>
            </UDropdownMenu>
          </UTooltip>
          <button v-else
            type="button"
            :class="navLinkClass(isSalesV2Section)"
            class="w-full flex items-center"
            @click="isSalesV2Open = !isSalesV2Open"
          >
            <UIcon name="i-lucide-chart-column" class="size-4 shrink-0" />
            <span class="flex-1 text-left">Sales-V2</span>
            <UIcon name="i-lucide-chevron-right" :class="['size-4 shrink-0 transition-transform', isSalesV2Open && 'rotate-90']" />
          </button>
          <ul v-if="!collapsed && isSalesV2Open" class="mt-1 ml-4 space-y-0.5 border-l border-gray-200 pl-3">
            <li><NuxtLink to="/daily-ops/sales-v2/by-day" :class="navLinkClass(isPath('/daily-ops/sales-v2/by-day'))">By Day</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales-v2/by-hour" :class="navLinkClass(isPath('/daily-ops/sales-v2/by-hour'))">By Hour</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales-v2/by-table" :class="navLinkClass(isPath('/daily-ops/sales-v2/by-table'))">By Table</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales-v2/by-worker" :class="navLinkClass(isPath('/daily-ops/sales-v2/by-worker'))">By Worker</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales-v2/by-product" :class="navLinkClass(isPath('/daily-ops/sales-v2/by-product'))">By Product</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales-v2/by-guest-account" :class="navLinkClass(isPath('/daily-ops/sales-v2/by-guest-account'))">By Guest Account</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/sales-v2/day-breakdown" :class="navLinkClass(isPath('/daily-ops/sales-v2/day-breakdown'))">Day Breakdown</NuxtLink></li>
          </ul>
        </li>
        <!-- Sales-V3 (collapsible) -->
        <li>
          <UTooltip v-if="collapsed" text="Sales-V3" :popper="{ placement: 'right' }">
            <UDropdownMenu :items="salesV3DropdownItems" :popper="{ placement: 'right-start' }">
              <button
                type="button"
                :class="navLinkClass(isSalesV3Section)"
                class="w-full flex items-center"
              >
                <UIcon name="i-lucide-trending-up" class="size-5 shrink-0" />
              </button>
            </UDropdownMenu>
          </UTooltip>
          <button v-else
            type="button"
            :class="navLinkClass(isSalesV3Section)"
            class="w-full flex items-center"
            @click="isSalesV3Open = !isSalesV3Open"
          >
            <UIcon name="i-lucide-trending-up" class="size-4 shrink-0" />
            <span class="flex-1 text-left">Sales-V3</span>
            <UIcon name="i-lucide-chevron-right" :class="['size-4 shrink-0 transition-transform', isSalesV3Open && 'rotate-90']" />
          </button>
          <ul v-if="!collapsed && isSalesV3Open" class="mt-1 ml-4 space-y-0.5 border-l border-gray-200 pl-3">
            <li><NuxtLink to="/daily-ops-v3/sales" :class="navLinkClass(isPath('/daily-ops-v3/sales'))">Overview</NuxtLink></li>
            <li><NuxtLink to="/daily-ops-v3/sales/by-day" :class="navLinkClass(isPath('/daily-ops-v3/sales/by-day'))">By Day</NuxtLink></li>
            <li><NuxtLink to="/daily-ops-v3/sales/by-hour" :class="navLinkClass(isPath('/daily-ops-v3/sales/by-hour'))">By Hour</NuxtLink></li>
            <li><NuxtLink to="/daily-ops-v3/sales/by-product" :class="navLinkClass(isPath('/daily-ops-v3/sales/by-product'))">By Product</NuxtLink></li>
            <li><NuxtLink to="/daily-ops-v3/sales/by-waiter" :class="navLinkClass(isPath('/daily-ops-v3/sales/by-waiter'))">By Waiter</NuxtLink></li>
          </ul>
        </li>
        <!-- Workforce-V3 -->
        <li>
          <UTooltip v-if="collapsed" text="Workforce V3" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-ops-v3/workforce" :class="navLinkClass(isWorkforceV3)">
              <UIcon name="i-lucide-users-cog" class="size-5 shrink-0" />
              <span v-if="!collapsed">Workforce V3</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-ops-v3/workforce" :class="navLinkClass(isWorkforceV3)">
            <UIcon name="i-lucide-users-cog" class="size-4 shrink-0" />
            <span>Workforce V3</span>
          </NuxtLink>
        </li>
        <li>
          <button
            type="button"
            :class="navLinkClass(isInboxSection)"
            class="w-full flex items-center"
            @click="isInboxOpen = !isInboxOpen"
          >
            <UIcon name="i-lucide-mail" class="size-4 shrink-0" />
            <span v-if="!collapsed" class="flex-1 text-left">Inbox</span>
            <UIcon v-if="!collapsed" name="i-lucide-chevron-right" :class="['size-4 shrink-0 transition-transform', isInboxOpen && 'rotate-90']" />
          </button>
          <ul v-if="!collapsed && isInboxOpen" class="mt-1 ml-4 space-y-0.5 border-l border-gray-200 pl-3">
            <li><NuxtLink to="/daily-ops/inbox" :class="navLinkClass(route.path === '/daily-ops/inbox')">Overview</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/emails" :class="navLinkClass(route.path === '/daily-ops/inbox/emails')">Emails</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/upload" :class="navLinkClass(route.path === '/daily-ops/inbox/upload')">Upload</NuxtLink></li>
            <li class="pt-1 text-xs font-medium text-gray-500">Eitje</li>
            <li><NuxtLink to="/daily-ops/inbox/eitje" :class="navLinkClass(isInboxEitje)">Eitje</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/eitje/hours" :class="navLinkClass(route.path === '/daily-ops/inbox/eitje/hours')">Hours</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/eitje/contracts" :class="navLinkClass(route.path === '/daily-ops/inbox/eitje/contracts')">Contracts</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/eitje/finance" :class="navLinkClass(route.path === '/daily-ops/inbox/eitje/finance')">Finance</NuxtLink></li>
            <li class="pt-1 text-xs font-medium text-gray-500">Bork</li>
            <li><NuxtLink to="/daily-ops/inbox/bork" :class="navLinkClass(isInboxBork)">Bork</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/bork/sales" :class="navLinkClass(route.path === '/daily-ops/inbox/bork/sales')">Sales</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/bork/product-mix" :class="navLinkClass(route.path === '/daily-ops/inbox/bork/product-mix')">Product Mix</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/bork/food-beverage" :class="navLinkClass(route.path === '/daily-ops/inbox/bork/food-beverage')">Food & Beverage</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/bork/basis-report" :class="navLinkClass(route.path === '/daily-ops/inbox/bork/basis-report')">Basis Report</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/bork/sales-per-hour" :class="navLinkClass(route.path === '/daily-ops/inbox/bork/sales-per-hour')">Sales Per Hour</NuxtLink></li>
            <li class="pt-1 text-xs font-medium text-gray-500">Power-BI</li>
            <li><NuxtLink to="/daily-ops/inbox/power-bi" :class="navLinkClass(isInboxPowerBi)">Power-BI</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/power-bi/reports" :class="navLinkClass(route.path === '/daily-ops/inbox/power-bi/reports')">Reports</NuxtLink></li>
            <li class="pt-1 text-xs font-medium text-gray-500">Other</li>
            <li><NuxtLink to="/daily-ops/inbox/other" :class="navLinkClass(isInboxOther)">Other</NuxtLink></li>
            <li><NuxtLink to="/daily-ops/inbox/other/all-test-data" :class="navLinkClass(route.path === '/daily-ops/inbox/other/all-test-data')">All Test Data</NuxtLink></li>
          </ul>
        </li>
      </ul>
      <!-- Daily Notes / other environments -->
      <ul v-else class="space-y-1">
        <li>
          <UTooltip v-if="collapsed" text="Dashboard" :popper="{ placement: 'right' }">
            <NuxtLink to="/" :class="navLinkClass(isDashboard)">
              <UIcon name="i-lucide-layout-dashboard" class="size-5 shrink-0" />
              <span v-if="!collapsed">Dashboard</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/" :class="navLinkClass(isDashboard)">
            <UIcon name="i-lucide-layout-dashboard" class="size-4 shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="All Notes" :popper="{ placement: 'right' }">
            <NuxtLink to="/notes/all" :class="navLinkClass(isAllNotes)">
              <UIcon name="i-lucide-file-text" class="size-5 shrink-0" />
              <span v-if="!collapsed">All Notes</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/notes/all" :class="navLinkClass(isAllNotes)">
            <UIcon name="i-lucide-file-text" class="size-4 shrink-0" />
            <span>All Notes</span>
          </NuxtLink>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="Todo's List" :popper="{ placement: 'right' }">
            <NuxtLink to="/notes/todos" :class="navLinkClass(isTodos)">
              <UIcon name="i-lucide-list-checks" class="size-5 shrink-0" />
              <span v-if="!collapsed">Todo's List</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/notes/todos" :class="navLinkClass(isTodos)">
            <UIcon name="i-lucide-list-checks" class="size-4 shrink-0" />
            <span>Todo's List</span>
          </NuxtLink>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="Agreed List" :popper="{ placement: 'right' }">
            <NuxtLink to="/notes/agreed" :class="navLinkClass(isAgreed)">
              <UIcon name="i-lucide-handshake" class="size-5 shrink-0" />
              <span v-if="!collapsed">Agreed List</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/notes/agreed" :class="navLinkClass(isAgreed)">
            <UIcon name="i-lucide-handshake" class="size-4 shrink-0" />
            <span>Agreed List</span>
          </NuxtLink>
        </li>
        <li>
          <UTooltip v-if="collapsed" text="Projects" :popper="{ placement: 'right' }">
            <NuxtLink to="/notes/projects" :class="navLinkClass(isProjects)">
              <UIcon name="i-lucide-folder-kanban" class="size-5 shrink-0" />
              <span v-if="!collapsed">Projects</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/notes/projects" :class="navLinkClass(isProjects)">
            <UIcon name="i-lucide-folder-kanban" class="size-4 shrink-0" />
            <span>Projects</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <!-- Footer: Organisation (fixed to bottom) -->
    <div
      class="shrink-0 border-t border-gray-200 p-2"
      :class="collapsed ? 'px-2' : 'p-4'"
    >
      <UTooltip v-if="collapsed" text="Organisation" :popper="{ placement: 'right' }">
        <NuxtLink to="/organisation" :class="navLinkClass(isOrganisation)" class="flex items-center">
          <UIcon name="i-lucide-building-2" class="size-5 shrink-0" />
        </NuxtLink>
      </UTooltip>
      <NuxtLink v-else to="/organisation" :class="navLinkClass(isOrganisation)" class="flex items-center gap-3">
        <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
        <span>Organisation</span>
      </NuxtLink>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { EnvironmentId } from '~/types/environment'
import { ENVIRONMENT_INITIALS, ENVIRONMENT_LABELS } from '~/types/environment'

const props = withDefaults(
  defineProps<{ collapsed?: boolean }>(),
  { collapsed: true }
)

const route = useRoute()
const { activeEnvironment, setActiveEnvironment, getEnvironmentLabel } = useEnvironment()

const environmentInitials = computed(() => ENVIRONMENT_INITIALS[activeEnvironment.value])

const envDropdownItems = computed(() => [
  (Object.entries(ENVIRONMENT_LABELS) as [EnvironmentId, string][]).map(([value, label]) => ({
    label,
    onSelect: () => setActiveEnvironment(value),
  })),
])

const hoursDropdownItems = computed(() => [
  [{
    label: 'Day & Location',
    to: '/daily-ops/hours',
  }, {
    label: 'By Day',
    to: '/daily-ops/hours/by-day',
  }, {
    label: 'By Team',
    to: '/daily-ops/hours/by-team',
  }, {
    label: 'By Location',
    to: '/daily-ops/hours/by-location',
  }],
])

const salesDropdownItems = computed(() => [
  [{
    label: 'Overview',
    to: '/daily-ops/sales',
  }, {
    label: 'By Hour',
    to: '/daily-ops/sales/by-hour',
  }, {
    label: 'By Table',
    to: '/daily-ops/sales/by-table',
  }, {
    label: 'By Worker',
    to: '/daily-ops/sales/by-worker',
  }, {
    label: 'By Product',
    to: '/daily-ops/sales/by-product',
  }, {
    label: 'By Guest Account',
    to: '/daily-ops/sales/by-guest-account',
  }, {
    label: 'Day Breakdown',
    to: '/daily-ops/sales/day-breakdown',
  }],
])

const salesV2DropdownItems = computed(() => [
  [{
    label: 'By Day',
    to: '/daily-ops/sales-v2/by-day',
  }, {
    label: 'By Hour',
    to: '/daily-ops/sales-v2/by-hour',
  }, {
    label: 'By Table',
    to: '/daily-ops/sales-v2/by-table',
  }, {
    label: 'By Worker',
    to: '/daily-ops/sales-v2/by-worker',
  }, {
    label: 'By Product',
    to: '/daily-ops/sales-v2/by-product',
  }, {
    label: 'By Guest Account',
    to: '/daily-ops/sales-v2/by-guest-account',
  }, {
    label: 'Day Breakdown',
    to: '/daily-ops/sales-v2/day-breakdown',
  }],
])

const hoursV3DropdownItems = computed(() => [
  [{
    label: 'Overview',
    to: '/daily-ops-v3/hours',
  }, {
    label: 'By Day',
    to: '/daily-ops-v3/hours/by-day',
  }, {
    label: 'By Hour',
    to: '/daily-ops-v3/hours/by-hour',
  }, {
    label: 'By Team',
    to: '/daily-ops-v3/hours/by-team',
  }, {
    label: 'By Contract',
    to: '/daily-ops-v3/hours/by-contract',
  }],
])

const salesV3DropdownItems = computed(() => [
  [{
    label: 'Overview',
    to: '/daily-ops-v3/sales',
  }, {
    label: 'By Day',
    to: '/daily-ops-v3/sales/by-day',
  }, {
    label: 'By Hour',
    to: '/daily-ops-v3/sales/by-hour',
  }, {
    label: 'By Product',
    to: '/daily-ops-v3/sales/by-product',
  }, {
    label: 'By Waiter',
    to: '/daily-ops-v3/sales/by-waiter',
  }],
])

const isDashboard = computed(() => route.path === '/' || route.path === '')
const isAllNotes = computed(() => route.path === '/notes/all')
const isTodos = computed(() => route.path === '/notes/todos')
const isAgreed = computed(() => route.path === '/notes/agreed')
const isProjects = computed(() => route.path === '/notes/projects')
const isOrganisation = computed(() => route.path === '/organisation')

// Daily Ops nav state
const isHoursOpen = ref(false)
const isSalesOpen = ref(false)
const isSalesV2Open = ref(false)
const isHoursV3Open = ref(false)
const isSalesV3Open = ref(false)
const isInboxOpen = ref(false)
const isDailyOpsDashboard = computed(() => {
  const p = route.path.replace(/\/$/, '') || '/'
  if (
    p.startsWith('/daily-ops/settings')
    || p.startsWith('/daily-ops/hours')
    || p.startsWith('/daily-ops/inbox')
  ) {
    return false
  }
  const dash = [
    '/daily-ops',
    '/daily-ops/revenue',
    '/daily-ops/productivity',
    '/daily-ops/workload',
    '/daily-ops/products',
    '/daily-ops/insights',
  ]
  return dash.includes(p)
})
const isWorkersPage = computed(() => route.path === '/daily-ops/workers' || route.path === '/daily-ops/workers/')
const isDailyOpsV2Dashboard = computed(() => route.path === '/daily-ops-v2' || route.path === '/daily-ops-v2/')
const isDailyOpsV3Dashboard = computed(() => route.path === '/daily-ops-v3' || route.path === '/daily-ops-v3/')
const isEitjeApi = computed(() => route.path === '/daily-ops/settings/eitje-api')
const isBorkApi = computed(() => route.path === '/daily-ops/settings/bork-api')
const isHoursSection = computed(() => route.path.startsWith('/daily-ops/hours') && !route.path.startsWith('/daily-ops-v3'))
const isHoursV3Section = computed(() => route.path.startsWith('/daily-ops-v3/hours'))

const normalizedPath = computed(() => (route.path.replace(/\/$/, '') || '/') as string)
const isSalesV2Section = computed(
  () =>
    normalizedPath.value.startsWith('/daily-ops/sales-v2/')
    || /\/daily-ops\/sales\/.+-v2$/.test(normalizedPath.value)
)
const isSalesV3Section = computed(
  () => normalizedPath.value.startsWith('/daily-ops-v3/sales')
)
const isSalesSection = computed(
  () => route.path.startsWith('/daily-ops/sales') && !isSalesV2Section.value && !isSalesV3Section.value
)
const isWorkforceV3 = computed(() => route.path === '/daily-ops-v3/workforce' || route.path.startsWith('/daily-ops-v3/workforce/'))
const isInboxSection = computed(() => route.path.startsWith('/daily-ops/inbox'))

function isPath(path: string) {
  return normalizedPath.value === path.replace(/\/$/, '') || normalizedPath.value === path
}
const isInboxEitje = computed(() => route.path === '/daily-ops/inbox/eitje' || route.path.startsWith('/daily-ops/inbox/eitje/'))
const isInboxBork = computed(() => route.path === '/daily-ops/inbox/bork' || route.path.startsWith('/daily-ops/inbox/bork/'))
const isInboxPowerBi = computed(() => route.path === '/daily-ops/inbox/power-bi' || route.path.startsWith('/daily-ops/inbox/power-bi/'))
const isInboxOther = computed(() => route.path === '/daily-ops/inbox/other' || route.path.startsWith('/daily-ops/inbox/other/'))

watch(() => route.path, (path: string) => {
  if (path.startsWith('/daily-ops/hours-v3')) {
    isHoursV3Open.value = true
  } else if (path.startsWith('/daily-ops/hours')) {
    isHoursOpen.value = true
  }
  const p = path.replace(/\/$/, '') || '/'
  if (p.startsWith('/daily-ops/sales-v3')) {
    isSalesV3Open.value = true
  } else if (p.startsWith('/daily-ops/sales-v2/') || (p.startsWith('/daily-ops/sales/') && /-v2$/.test(p))) {
    isSalesV2Open.value = true
  } else if (path.startsWith('/daily-ops/sales')) {
    isSalesOpen.value = true
  }
  if (path.startsWith('/daily-ops/inbox')) isInboxOpen.value = true
}, { immediate: true })

function navLinkClass(active: boolean) {
  return [
    'flex items-center rounded-md text-sm font-medium no-underline transition-colors',
    props.collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
    active
      ? 'bg-gray-200 text-gray-900'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  ]
}
</script>
