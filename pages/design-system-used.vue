<template>
  <div class="min-h-screen bg-[hsl(45,15%,95%)] p-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-4xl font-bold text-gray-900 mb-12">Design System Used</h1>

      <!-- Segmented Controls -->
      <section class="mb-16">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <SegmentedControl 
              v-model="period" 
              :options="[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' }
              ]"
            />
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <SegmentedControl 
              v-model="section" 
              :options="[
                { id: 'daily-ops', label: 'Daily Ops' },
                { id: 'revenue', label: 'Revenue' },
                { id: 'productivity', label: 'Productivity' }
              ]"
            />
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <SegmentedControl 
              v-model="location" 
              :options="[
                { id: 'all', label: 'All Locations' },
                { id: 'ams', label: 'Amsterdam' },
                { id: 'rdam', label: 'Rotterdam' }
              ]"
            />
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <ButtonGroup shadow>
              <button type="button" class="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-semibold">Gmail</button>
              <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold">Sync</button>
              <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold">Process</button>
            </ButtonGroup>
          </div>
        </div>
      </section>

      <!-- Navigation Links -->
      <section class="mb-16">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-2">
            <NavLink to="/daily-ops" active icon="i-lucide-layout-dashboard">Dashboard</NavLink>
            <NavLink to="/notes" icon="i-lucide-file-text">All Notes</NavLink>
            <NavLink to="/todos" icon="i-lucide-list-checks">Todo's List</NavLink>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-2">
            <NavLink to="/daily-ops" active icon="i-lucide-layout-dashboard" collapsed />
            <NavLink to="/notes" icon="i-lucide-file-text" collapsed />
            <NavLink to="/todos" icon="i-lucide-list-checks" collapsed />
          </div>
        </div>
      </section>

      <!-- Settings Tabs -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <SettingsTabs 
            v-model="apiTab" 
            :tabs="[
              { id: 'eitje', label: 'Eitje API' },
              { id: 'bork', label: 'Bork API' },
              { id: 'webhooks', label: 'Webhooks' }
            ]"
          />
          <div class="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            Content for {{ apiTab }} tab
          </div>
        </div>
      </section>

      <!-- UButton Styles -->
      <section class="mb-16">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-3">
            <UButton class="bg-gray-900! text-white! w-full">Solid Primary</UButton>
            <UButton variant="soft" class="bg-gray-100! text-gray-900! w-full">Soft Secondary</UButton>
            <UButton variant="outline" class="border-2! border-gray-900! w-full">Outline</UButton>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-3">
            <UButton variant="ghost" class="w-full">Ghost</UButton>
            <UButton color="red" variant="soft" class="w-full">Destructive</UButton>
            <UButton color="red" variant="outline" class="w-full">Delete</UButton>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-3">
            <UButton size="sm" class="bg-gray-900! text-white! w-full">Small</UButton>
            <UButton size="md" class="bg-gray-900! text-white! w-full">Medium</UButton>
            <UButton size="lg" class="bg-gray-900! text-white! w-full">Large</UButton>
          </div>
        </div>
      </section>

      <!-- Icon Buttons -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-4">
          <div class="flex gap-2">
            <IconButton icon="i-lucide-trash-2" label="Delete" variant="destructive" />
            <IconButton icon="i-lucide-x" label="Close" variant="destructive" />
            <IconButton icon="i-lucide-copy" label="Copy" />
            <IconButton icon="i-lucide-download" label="Download" />
          </div>
        </div>
      </section>

      <!-- Soft Segmented (Todos) -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <div class="inline-flex max-w-max flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
            <button type="button" class="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-medium">All</button>
            <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500">Active</button>
            <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-medium">Completed</button>
          </div>
        </div>
      </section>

      <!-- Note Editor Tabs -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <div class="border border-black rounded-md p-0.5 inline-flex gap-0">
            <button type="button" class="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium">Details</button>
            <button type="button" class="text-gray-700 hover:bg-gray-100 px-4 py-2 rounded text-sm font-medium">Todo</button>
            <button type="button" class="text-gray-700 hover:bg-gray-100 px-4 py-2 rounded text-sm font-medium">Agreed</button>
          </div>
        </div>
      </section>

      <!-- Marketing Tiles -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <div class="flex flex-wrap gap-4">
            <a href="#" class="w-32 p-4 rounded-lg bg-blue-100 text-blue-600 border border-blue-100 hover:border-primary-300 transition-colors text-center">
              <div class="text-3xl mb-2">📋</div>
              <p class="text-xs font-medium">Menu</p>
            </a>
            <a href="#" class="w-32 p-4 rounded-lg bg-green-100 text-green-600 border border-green-100 hover:border-primary-300 transition-colors text-center">
              <div class="text-3xl mb-2">🎯</div>
              <p class="text-xs font-medium">Specials</p>
            </a>
            <a href="#" class="w-32 p-4 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 hover:border-primary-300 transition-colors text-center">
              <div class="text-3xl mb-2">👥</div>
              <p class="text-xs font-medium">Team</p>
            </a>
            <a href="#" class="w-32 p-4 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 hover:border-primary-300 transition-colors text-center">
              <div class="text-3xl mb-2">🔗</div>
              <p class="text-xs font-medium">Links</p>
            </a>
          </div>
        </div>
      </section>

      <!-- Member Chips -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <div class="flex flex-wrap gap-2">
            <span style="font-size: 11px" class="uppercase tracking-wide font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded">Team A</span>
            <span style="font-size: 11px" class="uppercase tracking-wide font-medium bg-sky-50 text-sky-700 px-2 py-1 rounded">Team B</span>
            <span style="font-size: 11px" class="uppercase tracking-wide font-medium bg-blue-100 text-blue-600 px-2 py-1 rounded">Team C</span>
            <span style="font-size: 11px" class="uppercase tracking-wide font-medium bg-green-100 text-green-600 px-2 py-1 rounded">Team D</span>
          </div>
        </div>
      </section>

      <!-- Mini Badges -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-3">
          <div class="flex gap-2">
            <span style="font-size: 10px" class="uppercase font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">Inactive</span>
            <span style="font-size: 10px" class="uppercase font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">Active</span>
            <span style="font-size: 10px" class="uppercase font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded">Pending</span>
          </div>
        </div>
      </section>

      <!-- Upload Drag State -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <div class="border-2 border-dashed border-primary-500 bg-primary-50 rounded-lg p-8 text-center">
            <p class="text-sm text-gray-600">Drag zone</p>
          </div>
        </div>
      </section>

      <!-- Form Focus State -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <input type="text" placeholder="Focus on me..." class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" />
        </div>
      </section>

      <!-- Typography Examples -->
      <section class="mb-16">
        <div class="space-y-4">
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p style="font-size: 38px" class="font-extrabold tracking-[-0.02em] text-gray-900">Dashboard Hero (38px)</p>
          </div>
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p style="font-size: 34px" class="font-extrabold tracking-[-0.02em] text-gray-900">Section Title (34px)</p>
          </div>
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-5xl font-bold text-gray-900">Note Title (text-5xl)</p>
          </div>
        </div>
      </section>

      <!-- Member Profile Card -->
      <section>
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <div class="rounded-lg overflow-hidden bg-linear-to-br from-[hsl(45,20%,99%)] to-[hsl(45,25%,82%)] border-2 border-[hsl(45,25%,82%)] p-6 mb-4">
            <p class="text-lg font-bold text-gray-900 mb-2">Profile Card</p>
            <p class="text-sm text-gray-600">With gradient background</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span style="font-size: 11px" class="uppercase tracking-wide font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded">Emerald chip</span>
            <span style="font-size: 11px" class="uppercase tracking-wide font-medium bg-sky-50 text-sky-700 px-2 py-1 rounded">Sky chip</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const period = ref<'today' | 'week' | 'month'>('today')
const section = ref<'daily-ops' | 'revenue' | 'productivity'>('daily-ops')
const location = ref<'all' | 'ams' | 'rdam'>('all')
const apiTab = ref<'eitje' | 'bork' | 'webhooks'>('eitje')
</script>
