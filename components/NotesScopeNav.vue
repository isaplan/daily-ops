<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <nav class="flex gap-2 flex-wrap" aria-label="Filter notes">
      <NuxtLink
        :to="{ path: '/notes/all', query: {} }"
        class="rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors"
        :class="tabClass('all')"
      >
        All
      </NuxtLink>
      <NuxtLink
        :to="{ path: '/notes/all', query: { scope: 'private' } }"
        class="rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors"
        :class="tabClass('private')"
      >
        Private
      </NuxtLink>
      <NuxtLink
        :to="{ path: '/notes/all', query: { scope: 'public' } }"
        class="rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors"
        :class="tabClass('public')"
      >
        Public
      </NuxtLink>
      <NuxtLink
        :to="{ path: '/notes/all', query: { scope: 'drafts' } }"
        class="rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors"
        :class="tabClass('drafts')"
      >
        Drafts & Concepts
      </NuxtLink>
    </nav>
    <NuxtLink
      to="/notes/trash"
      class="rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors shrink-0"
      :class="tabClass('deleted')"
    >
      Deleted
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
export type NotesScopeNavActive = 'all' | 'private' | 'public' | 'drafts' | 'deleted'

const props = defineProps<{
  active: NotesScopeNavActive
}>()

function tabClass(id: NotesScopeNavActive): string {
  return props.active === id
    ? 'bg-gray-200 text-gray-900'
    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
}
</script>
