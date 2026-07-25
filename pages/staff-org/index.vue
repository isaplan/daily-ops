<template>
  <div class="space-y-6 p-4 md:p-6">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">Staff Org</h1>
      <p class="text-sm text-gray-600">
        Save and reorganise weekly FT staff boards (day / evening × Mon–Sun). Not linked to Daily Ops snapshots.
      </p>
    </header>

    <form class="flex flex-wrap items-end gap-3" @submit.prevent="createScenario">
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-600">New scenario</label>
        <input
          v-model="newName"
          type="text"
          placeholder="e.g. Close LAT → Bea/VKB"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
      </div>
      <UButton type="submit" size="sm" :loading="creating" :disabled="!newName.trim()">
        Create
      </UButton>
      <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>
    </form>

    <div v-if="pending" class="text-sm text-gray-500">Loading…</div>
    <ul v-else class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      <li v-if="scenarios.length === 0" class="px-4 py-8 text-center text-sm text-gray-500">
        No scenarios yet. Create one to start organising.
      </li>
      <li
        v-for="s in scenarios"
        :key="s._id"
        class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
      >
        <NuxtLink :to="`/staff-org/${s._id}`" class="min-w-0 flex-1">
          <p class="font-semibold text-gray-900">{{ s.name }}</p>
          <p class="text-xs text-gray-500">
            {{ s.status }} · {{ s.placementCount }} placements · {{ s.rosterCount }} roster ·
            updated {{ formatWhen(s.updatedAt) }}
          </p>
        </NuxtLink>
        <UButton
          v-if="s.status !== 'archived'"
          size="xs"
          variant="outline"
          color="neutral"
          @click="archiveScenario(s._id)"
        >
          Archive
        </UButton>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: pages/staff-org/index
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T18:00:00.000Z
 * @description: Staff Org scenario list — create / open / archive
 * @last-fix: [2026-07-22] Initial Staff Org list page
 * @adr-ref: ADR-016
 */

import type { StaffOrgScenarioListItem } from '~/types/staff-org'

definePageMeta({ keepalive: false })

const newName = ref('')
const creating = ref(false)
const errorMsg = ref('')

const { data, pending, refresh } = await useAsyncData(
  'staff-org-scenarios',
  () => $fetch<{ success: boolean; data: StaffOrgScenarioListItem[] }>('/api/staff-org/scenarios'),
)

const scenarios = computed(() => data.value?.data ?? [])

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

async function createScenario() {
  const name = newName.value.trim()
  if (!name || creating.value) return
  creating.value = true
  errorMsg.value = ''
  try {
    const res = await $fetch<{ success: boolean; data: { _id: string } }>('/api/staff-org/scenarios', {
      method: 'POST',
      body: { name },
    })
    newName.value = ''
    await navigateTo(`/staff-org/${res.data._id}`)
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : 'Create failed'
  } finally {
    creating.value = false
  }
}

async function archiveScenario(id: string) {
  await $fetch(`/api/staff-org/scenarios/${id}`, {
    method: 'PATCH',
    body: { status: 'archived' },
  })
  await refresh()
}
</script>
