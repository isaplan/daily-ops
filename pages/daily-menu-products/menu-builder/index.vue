<!--
/**
 * @registry-id: MenuBuilderIndex
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Menu builder listing page - displays all menus with create/open options
 * @last-fix: [2026-03-02] Restructured from single file to index + [id] routes
 * @exports-to:
 * ✓ nuxt-app/server/api/menu/menus.post.ts => Creates new menu entries
 * ✓ nuxt-app/server/api/menu/menus.get.ts => Fetches menu list
 */
-->
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
        <h2 class="text-sm font-semibold text-gray-900 mb-1">Menus</h2>
        <p class="text-xs text-gray-500 mb-3">
          Click a menu to open it: add products to sections, manage the menu, and export to Excel / Word / PDF.
        </p>
        <ul class="space-y-3">
          <li
            v-for="menu in menus"
            :key="menu._id"
            class="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 transition-colors hover:bg-gray-100 hover:border-gray-300"
          >
            <NuxtLink
              :to="`/daily-menu-products/menu-builder/${menu._id}`"
              class="block cursor-pointer group"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-medium text-gray-900 group-hover:text-primary-600">{{ menu.name }}</span>
                <span class="text-xs text-gray-500 flex items-center gap-1">
                  Open
                  <UIcon name="i-lucide-chevron-right" class="size-3.5" />
                </span>
              </div>
              <div v-if="menu.startDate || menu.location" class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                <span v-if="menu.startDate">Start: {{ formatDate(menu.startDate) }}</span>
                <span v-if="menu.location">{{ menu.location }}</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <template v-if="(menu.menuSections?.length ?? 0) > 0">
                  <span
                    v-for="sec in (menu.menuSections ?? [])"
                    :key="sec.id"
                    class="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700"
                  >
                    {{ sec.name }} ({{ sec.productIds?.length ?? 0 }})
                  </span>
                </template>
                <template v-else>
                  <span class="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-500">
                    No sections yet
                  </span>
                </template>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>

    <UModal :open="showNewMenuModal" :ui="{ width: 'sm:max-w-md' }" @update:open="showNewMenuModal = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Create Menu</h2>
          <UFormField label="Title">
            <UInput
              v-model="form.name"
              placeholder="e.g. Bar kaart 2025"
              autofocus
              @keydown.enter.prevent="createMenu"
            />
          </UFormField>
          <UFormField label="Location">
            <select
              v-model="form.location"
              class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              @keydown.enter.prevent="createMenu"
            >
              <option value="">
                Select location
              </option>
              <option value="Kinsbergen">
                Kinsbergen
              </option>
              <option value="Barbea">
                Barbea
              </option>
              <option value="l'Amour Toujours">
                l'Amour Toujours
              </option>
            </select>
          </UFormField>
          <UFormField label="Start date">
            <UInput
              v-model="form.startDate"
              type="date"
              @keydown.enter.prevent="createMenu"
            />
          </UFormField>
          <p class="text-xs text-gray-500">
            Next you’ll add sections, products, and run calculations on the Menu Building page.
          </p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showNewMenuModal = false">
              Cancel
            </UButton>
            <UButton :loading="creating" :disabled="!form.name.trim()" @click="createMenu">
              Create Menu
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

const sectionLabels = [
  { key: 'drinks', label: 'Drinks' },
  { key: 'diner', label: 'Diner' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'coursesMenu', label: 'Courses' },
]

const showNewMenuModal = ref(false)
const form = ref({
  name: '',
  startDate: '',
  location: '',
})
const creating = ref(false)

const { data: menusData, refresh: refreshMenus } = await useFetch<{ success: boolean; data: Menu[] }>(
  '/api/menu/menus'
)
const menus = computed(() => menusData.value?.data ?? [])

function openNewMenuModal() {
  form.value = { name: '', startDate: '', location: '' }
  showNewMenuModal.value = true
}

async function createMenu() {
  const name = form.value.name.trim()
  if (!name) return
  creating.value = true
  try {
    const res = await $fetch<{ data: { _id: string } }>('/api/menu/menus', {
      method: 'POST',
      body: {
        name,
        startDate: form.value.startDate || undefined,
        location: form.value.location || undefined,
      },
    })
    showNewMenuModal.value = false
    if (res?.data?._id) {
      await navigateTo(`/daily-menu-products/menu-builder/${res.data._id}`)
    }
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
