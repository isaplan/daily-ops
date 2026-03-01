<template>
  <aside
    class="shrink-0 border-r border-gray-200 bg-white flex flex-col h-full z-10 transition-[width] duration-200 ease-linear w-16 min-w-16 max-w-16"
    :class="{ '!w-64 !min-w-64 !max-w-64': !collapsed }"
  >
    <!-- Header: logo + env switcher (env only when expanded) -->
    <div
      class="flex items-center border-b border-gray-200 shrink-0"
      :class="collapsed ? 'justify-center px-0 py-3' : 'gap-2 px-4 py-3'"
    >
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
        <UIcon name="i-lucide-layout-dashboard" class="size-4" />
      </div>
      <USelectMenu
        v-if="!collapsed"
        v-model="selectedEnv"
        :items="environmentOptions"
        value-key="value"
        class="min-w-0 flex-1"
        :ui="{
          trigger: '!bg-white !text-gray-900 border border-gray-200 shadow-none focus:ring-0 hover:!bg-gray-50 ring-0 rounded-md py-0 min-h-0 min-w-0 flex-1',
          value: 'text-sm font-semibold text-gray-900',
        }"
        @update:model-value="onEnvironmentChange"
      />
    </div>

    <nav class="flex-1 p-2 overflow-y-auto" :class="collapsed ? 'px-2' : 'p-4'">
      <p v-if="!collapsed" class="mb-2 text-xs font-semibold uppercase tracking-tight text-gray-500">
        Navigation
      </p>
      <ul class="space-y-1">
        <template v-if="activeEnvironment === 'daily-notes'">
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
            <UTooltip v-if="collapsed" text="Private Notes" :popper="{ placement: 'right' }">
              <NuxtLink to="/notes/private" :class="navLinkClass(isPrivateNotes)">
                <UIcon name="i-lucide-lock" class="size-5 shrink-0" />
                <span v-if="!collapsed">Private Notes</span>
              </NuxtLink>
            </UTooltip>
            <NuxtLink v-else to="/notes/private" :class="navLinkClass(isPrivateNotes)">
              <UIcon name="i-lucide-lock" class="size-4 shrink-0" />
              <span>Private Notes</span>
            </NuxtLink>
          </li>
          <li>
            <UTooltip v-if="collapsed" text="Public Notes" :popper="{ placement: 'right' }">
              <NuxtLink to="/notes/public" :class="navLinkClass(isPublicNotes)">
                <UIcon name="i-lucide-globe" class="size-5 shrink-0" />
                <span v-if="!collapsed">Public Notes</span>
              </NuxtLink>
            </UTooltip>
            <NuxtLink v-else to="/notes/public" :class="navLinkClass(isPublicNotes)">
              <UIcon name="i-lucide-globe" class="size-4 shrink-0" />
              <span>Public Notes</span>
            </NuxtLink>
          </li>
          <li>
            <UTooltip v-if="collapsed" text="Drafts & Concepts" :popper="{ placement: 'right' }">
              <NuxtLink to="/notes/drafts" :class="navLinkClass(isDrafts)">
                <UIcon name="i-lucide-file-edit" class="size-5 shrink-0" />
                <span v-if="!collapsed">Drafts & Concepts</span>
              </NuxtLink>
            </UTooltip>
            <NuxtLink v-else to="/notes/drafts" :class="navLinkClass(isDrafts)">
              <UIcon name="i-lucide-file-edit" class="size-4 shrink-0" />
              <span>Drafts & Concepts</span>
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
            <UTooltip v-if="collapsed" text="New note" :popper="{ placement: 'right' }">
              <NuxtLink to="/notes/new" :class="navLinkClass(isNotesNew)">
                <UIcon name="i-lucide-file-plus" class="size-5 shrink-0" />
                <span v-if="!collapsed">New note</span>
              </NuxtLink>
            </UTooltip>
            <NuxtLink v-else to="/notes/new" :class="navLinkClass(isNotesNew)">
              <UIcon name="i-lucide-file-plus" class="size-4 shrink-0" />
              <span>New note</span>
            </NuxtLink>
          </li>
          <li>
            <UTooltip v-if="collapsed" text="New Weekly" :popper="{ placement: 'right' }">
              <NuxtLink to="/notes/new?template=weekly" :class="navLinkClass(isNotesWeekly)">
                <UIcon name="i-lucide-calendar-range" class="size-5 shrink-0" />
                <span v-if="!collapsed">New Weekly</span>
              </NuxtLink>
            </UTooltip>
            <NuxtLink v-else to="/notes/new?template=weekly" :class="navLinkClass(isNotesWeekly)">
              <UIcon name="i-lucide-calendar-range" class="size-4 shrink-0" />
              <span>New Weekly</span>
            </NuxtLink>
          </li>
        </template>
        <li v-if="activeEnvironment === 'daily-ops'">
          <UTooltip v-if="collapsed" text="Dashboard" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-ops" :class="navLinkClass(route.path === '/daily-ops')">
              <UIcon name="i-lucide-building-2" class="size-5 shrink-0" />
              <span v-if="!collapsed">Dashboard</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-ops" :class="navLinkClass(route.path === '/daily-ops')">
            <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-work'">
          <UTooltip v-if="collapsed" text="Dashboard" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-work" :class="navLinkClass(route.path === '/daily-work')">
              <UIcon name="i-lucide-layout-dashboard" class="size-5 shrink-0" />
              <span v-if="!collapsed">Dashboard</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-work" :class="navLinkClass(route.path === '/daily-work')">
            <UIcon name="i-lucide-layout-dashboard" class="size-4 shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-menu-products'">
          <UTooltip v-if="collapsed" text="Dashboard" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-menu-products" :class="navLinkClass(route.path === '/daily-menu-products')">
              <UIcon name="i-lucide-utensils-crossed" class="size-5 shrink-0" />
              <span v-if="!collapsed">Dashboard</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-menu-products" :class="navLinkClass(route.path === '/daily-menu-products')">
            <UIcon name="i-lucide-utensils-crossed" class="size-4 shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-menu-products'">
          <UTooltip v-if="collapsed" text="Products" :popper="{ placement: 'right' }">
            <NuxtLink to="/daily-menu-products/products" :class="navLinkClass(route.path === '/daily-menu-products/products')">
              <UIcon name="i-lucide-package" class="size-5 shrink-0" />
              <span v-if="!collapsed">Products</span>
            </NuxtLink>
          </UTooltip>
          <NuxtLink v-else to="/daily-menu-products/products" :class="navLinkClass(route.path === '/daily-menu-products/products')">
            <UIcon name="i-lucide-package" class="size-4 shrink-0" />
            <span>Products</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import type { EnvironmentId } from '~/types/environment'
import { ENVIRONMENT_LABELS } from '~/types/environment'

const props = withDefaults(
  defineProps<{ collapsed?: boolean }>(),
  { collapsed: true }
)

const route = useRoute()
const { activeEnvironment, setActiveEnvironment } = useEnvironment()

const environmentOptions = [
  { label: ENVIRONMENT_LABELS['daily-work'], value: 'daily-work' },
  { label: ENVIRONMENT_LABELS['daily-ops'], value: 'daily-ops' },
  { label: ENVIRONMENT_LABELS['daily-notes'], value: 'daily-notes' },
  { label: ENVIRONMENT_LABELS['daily-menu-products'], value: 'daily-menu-products' },
]

const selectedEnv = computed({
  get: () => activeEnvironment.value,
  set: (v: unknown) => {
    const id = typeof v === 'object' && v && 'value' in v ? (v as { value: string }).value : v
    if (typeof id === 'string') setActiveEnvironment(id as EnvironmentId)
  },
})

function onEnvironmentChange(value: unknown) {
  const id = typeof value === 'object' && value && 'value' in value ? (value as { value: string }).value : value
  if (typeof id === 'string') setActiveEnvironment(id as EnvironmentId)
}

const isDashboard = computed(() => route.path === '/' || route.path === '')
const isAllNotes = computed(() => route.path === '/notes/all')
const isPrivateNotes = computed(() => route.path === '/notes/private')
const isPublicNotes = computed(() => route.path === '/notes/public')
const isDrafts = computed(() => route.path === '/notes/drafts')
const isTodos = computed(() => route.path === '/notes/todos')
const isAgreed = computed(() => route.path === '/notes/agreed')
const isNotesNew = computed(() => route.path === '/notes/new' && !route.query.template)
const isNotesWeekly = computed(() => route.path === '/notes/new' && route.query.template === 'weekly')

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

<style scoped>
/* Force environment select trigger to white (Nuxt UI overrides ui.trigger) */
:deep(button[data-slot="base"]),
:deep([data-slot="base"].group) {
  background-color: white !important;
  color: #111827 !important;
  border: 1px solid #e5e7eb !important;
}
:deep(button[data-slot="base"]:hover),
:deep([data-slot="base"].group:hover) {
  background-color: #f9fafb !important;
}
</style>
