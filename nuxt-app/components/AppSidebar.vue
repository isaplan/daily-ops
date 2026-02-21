<template>
  <aside class="w-64 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
    <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
        <UIcon name="i-lucide-layout-dashboard" class="size-4" />
      </div>
      <USelectMenu
        v-model="selectedEnv"
        :items="environmentOptions"
        value-key="value"
        class="min-w-0 flex-1"
        :ui="{
          trigger: 'border-0 bg-transparent shadow-none focus:ring-0 hover:bg-transparent py-0 min-h-0',
          value: 'text-sm font-semibold text-gray-900',
        }"
        @update:model-value="onEnvironmentChange"
      />
    </div>

    <nav class="flex-1 p-4 overflow-y-auto">
      <p class="mb-2 text-xs font-semibold uppercase tracking-tight text-gray-500">
        Navigation
      </p>
      <ul class="space-y-1">
        <li v-if="activeEnvironment === 'daily-notes'">
          <NuxtLink to="/" :class="navLinkClass(isDashboard)">
            <UIcon name="i-lucide-layout-dashboard" class="size-4 shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-notes'">
          <NuxtLink to="/notes/all" :class="navLinkClass(isAllNotes)">
            <UIcon name="i-lucide-file-text" class="size-4 shrink-0" />
            <span>All Notes</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-notes'">
          <NuxtLink to="/notes/private" :class="navLinkClass(isPrivateNotes)">
            <UIcon name="i-lucide-lock" class="size-4 shrink-0" />
            <span>Private Notes</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-notes'">
          <NuxtLink to="/notes/public" :class="navLinkClass(isPublicNotes)">
            <UIcon name="i-lucide-globe" class="size-4 shrink-0" />
            <span>Public Notes</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-notes'">
          <NuxtLink to="/notes/drafts" :class="navLinkClass(isDrafts)">
            <UIcon name="i-lucide-file-edit" class="size-4 shrink-0" />
            <span>Drafts & Concepts</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-notes'">
          <NuxtLink to="/notes/todos" :class="navLinkClass(isTodos)">
            <UIcon name="i-lucide-list-checks" class="size-4 shrink-0" />
            <span>Todo's List</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-notes'">
          <NuxtLink to="/notes/agreed" :class="navLinkClass(isAgreed)">
            <UIcon name="i-lucide-handshake" class="size-4 shrink-0" />
            <span>Agreed List</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-notes'">
          <NuxtLink to="/notes/new" :class="navLinkClass(isNotesNew)">
            <UIcon name="i-lucide-file-plus" class="size-4 shrink-0" />
            <span>New note</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-notes'">
          <NuxtLink to="/notes/new?template=weekly" :class="navLinkClass(isNotesWeekly)">
            <UIcon name="i-lucide-calendar-range" class="size-4 shrink-0" />
            <span>New Weekly</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-ops'">
          <NuxtLink to="/daily-ops" :class="navLinkClass(route.path === '/daily-ops')">
            <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
        </li>
        <li v-if="activeEnvironment === 'daily-work'">
          <NuxtLink to="/daily-work" :class="navLinkClass(route.path === '/daily-work')">
            <UIcon name="i-lucide-layout-dashboard" class="size-4 shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import type { EnvironmentId } from '~/types/environment'
import { ENVIRONMENT_LABELS } from '~/types/environment'

const route = useRoute()
const { activeEnvironment, setActiveEnvironment } = useEnvironment()

const environmentOptions = [
  { label: ENVIRONMENT_LABELS['daily-work'], value: 'daily-work' },
  { label: ENVIRONMENT_LABELS['daily-ops'], value: 'daily-ops' },
  { label: ENVIRONMENT_LABELS['daily-notes'], value: 'daily-notes' },
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
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors',
    active
      ? 'bg-gray-200 text-gray-900'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  ]
}
</script>
