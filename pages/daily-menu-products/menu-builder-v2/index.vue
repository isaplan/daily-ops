<!--
  Menu Builder V2 list. Uses menus.get.ts, menus.post.ts, menus/copy.post.ts.
  Create menu, Copy menu (sets copiedFromMenuId), open menu → menu-builder-v2/[id].
-->
<template>
  <div class="w-full max-w-full space-y-6">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Menu Builder V2</h1>
          <p class="text-gray-600 text-sm">
            Sections and subsections, copy menu for price development, Show on Printed Menu, calculation mode.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton variant="outline" icon="i-lucide-copy" @click="openCopyModal">
            Copy menu
          </UButton>
          <UButton icon="i-lucide-plus" @click="openNewMenuModal">
            New menu
          </UButton>
        </div>
      </div>

      <NuxtLink to="/daily-menu-products" class="text-sm font-medium text-primary-600 hover:text-primary-700">
        Import CSV/Excel →
      </NuxtLink>
      <span class="text-gray-400 mx-2">|</span>
      <NuxtLink to="/daily-menu-products/menu-builder" class="text-sm text-gray-600 hover:text-gray-900">
        V1 Menu Builder
      </NuxtLink>

      <div v-if="menus.length > 0" class="mt-6 pt-6 border-t border-gray-200">
        <h2 class="text-sm font-semibold text-gray-900 mb-1">Menus</h2>
        <p class="text-xs text-gray-500 mb-3">
          Open to edit sections, subsections, products, and calculations. Copy a menu to create a new one linked for price development.
        </p>
        <ul class="space-y-3">
          <li
            v-for="menu in menus"
            :key="menu._id"
            class="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 transition-colors hover:bg-gray-100 hover:border-gray-300"
          >
            <NuxtLink :to="`/daily-menu-products/menu-builder-v2/${menu._id}`" class="block cursor-pointer group">
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
              <div v-if="menu.copiedFromMenuId" class="mt-1 text-xs text-gray-500">
                Copied from:
                <template v-if="menuById(menu.copiedFromMenuId)">
                  <NuxtLink
                    :to="`/daily-menu-products/menu-builder-v2/${menu.copiedFromMenuId}`"
                    class="text-primary-600 hover:underline"
                    @click.stop
                  >
                    {{ menuById(menu.copiedFromMenuId)?.name ?? menu.copiedFromMenuId }}
                  </NuxtLink>
                </template>
                <template v-else>{{ menu.copiedFromMenuId }}</template>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <template v-if="sectionCount(menu) > 0">
                  <span class="inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                    {{ sectionSummary(menu) }}
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
            <UInput v-model="form.name" placeholder="e.g. Bar kaart 2025" @keydown.enter.prevent="createMenu" />
          </UFormField>
          <UFormField label="Location">
            <select v-model="form.location" class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
              <option value="">Select location</option>
              <option value="Kinsbergen">Kinsbergen</option>
              <option value="Barbea">Barbea</option>
              <option value="l'Amour Toujours">l'Amour Toujours</option>
            </select>
          </UFormField>
          <UFormField label="Start date">
            <UInput v-model="form.startDate" type="date" @keydown.enter.prevent="createMenu" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showNewMenuModal = false">Cancel</UButton>
            <UButton :loading="creating" :disabled="!form.name.trim()" @click="createMenu">Create</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal :open="showCopyModal" :ui="{ width: 'sm:max-w-md' }" @update:open="showCopyModal = $event">
      <template #content>
        <div class="p-4 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Copy menu</h2>
          <UFormField label="Source menu">
            <select v-model="copyForm.copyFrom" class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">
              <option value="">Select menu</option>
              <option v-for="m in menus" :key="m._id" :value="m._id">{{ m.name }}</option>
            </select>
          </UFormField>
          <UFormField label="New name (optional)">
            <UInput v-model="copyForm.name" placeholder="Leave empty for “[Name] (copy)”" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showCopyModal = false">Cancel</UButton>
            <UButton :loading="copying" :disabled="!copyForm.copyFrom" @click="copyMenu">Copy</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Menu } from '~/types/menuItem'

definePageMeta({ layout: 'default' })

const showNewMenuModal = ref(false)
const showCopyModal = ref(false)
const form = ref({ name: '', startDate: '', location: '' })
const copyForm = ref({ copyFrom: '', name: '' })
const creating = ref(false)
const copying = ref(false)

const { data: menusData, refresh: refreshMenus } = await useFetch<{ success: boolean; data: Menu[] }>('/api/menu/menus')
const menus = computed(() => menusData.value?.data ?? [])

function menuById(id: string): Menu | undefined {
  return menus.value.find((m) => m._id === id)
}

function sectionCount(menu: Menu): number {
  if (menu.menuSectionsV2?.length) return menu.menuSectionsV2.length
  return menu.menuSections?.length ?? 0
}

function sectionSummary(menu: Menu): string {
  if (menu.menuSectionsV2?.length) {
    const total = menu.menuSectionsV2.reduce((acc, s) => acc + (s.subsections?.length ?? 0), 0)
    return `${menu.menuSectionsV2.length} section(s), ${total} subsection(s)`
  }
  const secs = menu.menuSections ?? []
  const products = secs.reduce((acc, s) => acc + (s.productIds?.length ?? 0), 0)
  return `${secs.length} section(s), ${products} product(s)`
}

function openNewMenuModal() {
  form.value = { name: '', startDate: '', location: '' }
  showNewMenuModal.value = true
}

function openCopyModal() {
  copyForm.value = { copyFrom: menus.value[0]?._id ?? '', name: '' }
  showCopyModal.value = true
}

async function createMenu() {
  const name = form.value.name.trim()
  if (!name) return
  creating.value = true
  try {
    const res = await $fetch<{ data: { _id: string } }>('/api/menu/menus', {
      method: 'POST',
      body: { name, startDate: form.value.startDate || undefined, location: form.value.location || undefined },
    })
    showNewMenuModal.value = false
    if (res?.data?._id) await navigateTo(`/daily-menu-products/menu-builder-v2/${res.data._id}`)
    await refreshMenus()
  } finally {
    creating.value = false
  }
}

async function copyMenu() {
  if (!copyForm.value.copyFrom) return
  copying.value = true
  try {
    const res = await $fetch<{ data: { _id: string } }>('/api/menu/menus/copy', {
      method: 'POST',
      body: { copyFrom: copyForm.value.copyFrom, name: copyForm.value.name?.trim() || undefined },
    })
    showCopyModal.value = false
    if (res?.data?._id) await navigateTo(`/daily-menu-products/menu-builder-v2/${res.data._id}`)
    await refreshMenus()
  } finally {
    copying.value = false
  }
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return '–'
  return (typeof d === 'string' ? new Date(d) : d).toLocaleDateString(undefined, { dateStyle: 'short' })
}
</script>
