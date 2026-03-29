<!--
/**
 * @registry-id: ProjectsIndex
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Projects listing page - displays all projects with create option
 * @last-fix: [2026-03-02] Initial page creation
 * @exports-to:
 * ✓ nuxt-app/server/api/notes/index.get.ts => Fetches projects
 */
-->
<template>
  <div class="space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-4xl font-bold mb-2 text-gray-900">Projects</h1>
        <p class="text-gray-700">Manage your projects.</p>
      </div>
      <a
        href="/notes/projects/create"
        class="shrink-0 inline-flex items-center gap-1.5 rounded-md font-medium px-2.5 py-1.5 text-sm bg-primary text-white hover:opacity-90 transition-opacity"
      >
        <UIcon name="i-lucide-plus" class="size-4" />
        Create project
      </a>
    </div>
    <div v-if="pending" class="flex gap-2">
      <div class="h-20 w-full rounded-lg bg-gray-100 animate-pulse" />
    </div>
    <p v-else-if="error" class="text-red-600">{{ String(error) }}</p>
    <ul v-else-if="projects.length" class="space-y-2">
      <li v-for="p in projects" :key="p._id">
        <NuxtLink
          :to="`/notes/projects/${p._id}`"
          class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:bg-gray-50"
        >
          <UIcon name="i-lucide-folder-kanban" class="size-5 shrink-0 text-gray-500" />
          <span class="font-medium text-gray-900">{{ p.title || 'Untitled project' }}</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="text-gray-500 py-8">No projects yet. Create one to get started.</p>
  </div>
</template>

<script setup lang="ts">
import type { Note } from '~/types/note'
import type { NotesListResponse } from '~/types/note'

useHead({ title: 'Projects' })

const { data, pending, error } = await useFetch<NotesListResponse>('/api/notes?tag=project&limit=50')
const projects = computed(() => (data.value?.data ?? []) as Note[])
</script>
