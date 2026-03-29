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
      <ul class="space-y-1">
        <!-- Always show daily-notes nav (no env selector) -->
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

const isDashboard = computed(() => route.path === '/' || route.path === '')
const isAllNotes = computed(() => route.path === '/notes/all')
const isTodos = computed(() => route.path === '/notes/todos')
const isAgreed = computed(() => route.path === '/notes/agreed')
const isProjects = computed(() => route.path === '/notes/projects')
const isOrganisation = computed(() => route.path === '/organisation')

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
