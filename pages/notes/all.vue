<template>
  <div class="space-y-4">
    <h1 class="text-4xl font-bold mb-2 text-gray-900">All Notes</h1>
    <p class="text-gray-700 mb-6">All your notes</p>
    <NotesScopeNav :active="navActive" />
    <NotesList
      :notes="data?.data ?? []"
      :pending="pending"
      :error="error"
      :skip="skip"
      :page-limit="pageLimit"
      @update:skip="skip = $event"
      @trashed="refresh()"
    />
  </div>
</template>

<script setup lang="ts">
import type { NotesListResponse } from '~/types/note'

const route = useRoute()
const scope = computed(() => (route.query.scope as string) || '')

const navActive = computed(() => {
  const s = scope.value
  if (s === 'private') return 'private' as const
  if (s === 'public') return 'public' as const
  if (s === 'drafts') return 'drafts' as const
  return 'all' as const
})

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
const { data, pending, error, refresh } = await useFetch<NotesListResponse>(url)
</script>
