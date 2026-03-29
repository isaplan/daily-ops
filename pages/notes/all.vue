<template>
  <div class="space-y-4">
    <h1 class="text-4xl font-bold mb-2 text-gray-900">All Notes</h1>
    <p class="text-gray-700 mb-6">All your notes</p>
    <nav class="flex gap-2 flex-wrap" aria-label="Filter notes">
      <NuxtLink
        :to="{ path: '/notes/all', query: {} }"
        class="rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors"
        :class="!scope ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
      >
        All
      </NuxtLink>
      <NuxtLink
        :to="{ path: '/notes/all', query: { scope: 'private' } }"
        class="rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors"
        :class="scope === 'private' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
      >
        Private
      </NuxtLink>
      <NuxtLink
        :to="{ path: '/notes/all', query: { scope: 'public' } }"
        class="rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors"
        :class="scope === 'public' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
      >
        Public
      </NuxtLink>
      <NuxtLink
        :to="{ path: '/notes/all', query: { scope: 'drafts' } }"
        class="rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors"
        :class="scope === 'drafts' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
      >
        Drafts & Concepts
      </NuxtLink>
    </nav>
    <NotesList
      :notes="data?.data ?? []"
      :pending="pending"
      :error="error"
      :skip="skip"
      :page-limit="pageLimit"
      @update:skip="skip = $event"
    />
  </div>
</template>

<script setup lang="ts">
import type { NotesListResponse } from '~/types/note'

const route = useRoute()
const scope = computed(() => (route.query.scope as string) || '')

const skip = ref(0)
const pageLimit = 20

watch(scope, () => { skip.value = 0 })

const url = computed(() => {
  const params = new URLSearchParams()
  params.set('skip', String(skip.value))
  params.set('limit', String(pageLimit))
  if (scope.value) params.set('scope', scope.value)
  return `/api/notes?${params.toString()}`
})
const { data, pending, error } = await useFetch<NotesListResponse>(url)
</script>
