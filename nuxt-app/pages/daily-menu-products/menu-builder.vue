<template>
  <div class="max-w-4xl space-y-6">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Menu Builder</h1>
          <p class="text-gray-600 text-sm">
            Build and organise your drinks and food menu. Use products imported in Daily Menu & Products.
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          @click="openNewMenuModal"
        >
          New menu
        </UButton>
      </div>

      <NuxtLink
        to="/daily-menu-products"
        class="text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        Import CSV/Excel →
      </NuxtLink>

      <div v-if="menus.length > 0" class="mt-6 pt-6 border-t border-gray-200">
        <h2 class="text-sm font-semibold text-gray-900 mb-3">Menus</h2>
        <ul class="space-y-2">
          <li
            v-for="menu in menus"
            :key="menu._id"
            class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3"
          >
            <span class="font-medium text-gray-900">{{ menu.name }}</span>
            <span class="text-xs text-gray-500">
              {{ formatDate(menu.updatedAt ?? menu.createdAt) }}
            </span>
          </li>
        </ul>
      </div>
    </div>

    <UModal v-model:open="showNewMenuModal" :ui="{ width: 'sm:max-w-md' }">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">New menu</h2>
          <UFormField label="Name">
            <UInput
              v-model="newMenuName"
              placeholder="e.g. Bar kaart 2025"
              autofocus
              @keydown.enter.prevent="createMenu"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showNewMenuModal = false">
              Cancel
            </UButton>
            <UButton :loading="creating" :disabled="!newMenuName.trim()" @click="createMenu">
              Create
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Menu } from '~/types/menuItem'

definePageMeta({
  layout: 'default',
})

const showNewMenuModal = ref(false)
const newMenuName = ref('')
const creating = ref(false)

const { data: menusData, refresh: refreshMenus } = await useFetch<{ success: boolean; data: Menu[] }>(
  '/api/menu/menus'
)
const menus = computed(() => menusData.value?.data ?? [])

function openNewMenuModal() {
  newMenuName.value = ''
  showNewMenuModal.value = true
}

async function createMenu() {
  const name = newMenuName.value.trim()
  if (!name) return
  creating.value = true
  try {
    await $fetch('/api/menu/menus', {
      method: 'POST',
      body: { name },
    })
    showNewMenuModal.value = false
    await refreshMenus()
  } finally {
    creating.value = false
  }
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return '–'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString(undefined, { dateStyle: 'short' })
}
</script>
