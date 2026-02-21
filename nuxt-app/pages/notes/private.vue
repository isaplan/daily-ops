<template>
  <div class="p-8 max-w-7xl mx-auto">
    <h1 class="text-4xl font-bold mb-2 text-gray-900">Private Notes</h1>
    <p class="text-gray-700 mb-6">Notes only you can see (no team/location)</p>
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

const skip = ref(0)
const pageLimit = 20

const url = computed(() => `/api/notes?scope=private&skip=${skip.value}&limit=${pageLimit}`)
const { data, pending, error } = await useFetch<NotesListResponse>(url)
</script>
