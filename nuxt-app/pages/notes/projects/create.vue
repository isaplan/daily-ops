<!--
/**
 * @registry-id: ProjectsCreate
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Project creation page - creates main note and project note, redirects to editor
 * @last-fix: [2026-03-02] Initial page creation
 * @exports-to:
 * ✓ nuxt-app/server/api/notes/index.get.ts => Creates new notes
 */
-->
<template>
  <div class="flex min-h-0 flex-1 flex-col items-center justify-center py-12">
    <div v-if="creating" class="text-gray-500">Creating project...</div>
    <p v-else-if="createError" class="text-red-600">{{ createError }}</p>
  </div>
</template>

<script setup lang="ts">
import type { NoteResponse } from '~/types/note'
import { serializeProjectOutlineV2, createProjectOutlineNode } from '~/types/projectOutline'

const creating = ref(true)
const createError = ref('')

onMounted(async () => {
  try {
    const mainRes = await $fetch<NoteResponse>('/api/notes', {
      method: 'POST',
      body: { title: 'Main', tags: [] },
    })
    const mainId = mainRes?.data?._id
    if (!mainId) {
      createError.value = 'Failed to create main note'
      return
    }
    const rootNode = createProjectOutlineNode(mainId, 'Main')
    const projectRes = await $fetch<NoteResponse>('/api/notes', {
      method: 'POST',
      body: {
        title: 'Untitled project',
        content: serializeProjectOutlineV2([rootNode]),
        tags: ['project'],
      },
    })
    const projectId = projectRes?.data?._id
    if (projectId) {
      await navigateTo(`/notes/projects/${projectId}`, { replace: true })
    } else {
      createError.value = 'Failed to create project'
    }
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e)
  } finally {
    creating.value = false
  }
})
</script>
