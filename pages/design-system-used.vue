<template>
  <div class="min-h-screen bg-[hsl(45,15%,95%)] p-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-4xl font-bold text-gray-900 mb-12">Design System Used</h1>

      <!-- Segmented Controls -->
      <section class="mb-16">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Daily Ops: Period Toggle</p>
            <div class="inline-flex max-w-max flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
              <button type="button" class="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-semibold">Today</button>
              <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold">This Week</button>
              <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold">This Month</button>
            </div>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Daily Ops: Section Navigation</p>
            <div class="inline-flex max-w-max flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
              <button type="button" class="bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-semibold">Daily Ops</button>
              <button type="button" class="text-gray-700 hover:bg-gray-100 px-4 py-1.5 rounded text-sm font-semibold">Revenue</button>
              <button type="button" class="text-gray-700 hover:bg-gray-100 px-4 py-1.5 rounded text-sm font-semibold">Productivity</button>
            </div>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Daily Ops: Location Shortcuts</p>
            <div class="inline-flex max-w-max flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
              <button type="button" class="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-semibold">All</button>
              <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold">Amsterdam</button>
              <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold">Rotterdam</button>
            </div>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Inbox: Action Buttons (Standalone, Not Grouped)</p>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                variant="solid"
                size="sm"
                color="success"
                icon="i-lucide-check"
                class="gap-1.5 font-semibold"
              >
                Connected Gmail
              </UButton>
              <UButton
                variant="solid"
                color="neutral"
                size="sm"
                icon="i-lucide-refresh-cw"
                class="gap-1.5 font-semibold"
              >
                Sync Gmail
              </UButton>
              <UButton
                variant="solid"
                color="neutral"
                size="sm"
                icon="i-lucide-sparkles"
                class="gap-1.5 font-semibold"
              >
                Process all
              </UButton>
            </div>
          </div>
        </div>
      </section>

      <!-- Navigation Links -->
      <section class="mb-16">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Sidebar: Expanded Navigation</p>
            <div class="space-y-2">
              <NuxtLink to="/daily-ops" class="flex items-center rounded-md text-sm font-medium gap-3 px-3 py-2 bg-gray-200 text-gray-900 transition-colors">
                <UIcon name="i-lucide-layout-dashboard" class="size-4" />
                <span>Dashboard</span>
              </NuxtLink>
              <NuxtLink to="/notes" class="flex items-center rounded-md text-sm font-medium gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <UIcon name="i-lucide-file-text" class="size-4" />
                <span>All Notes</span>
              </NuxtLink>
              <NuxtLink to="/todos" class="flex items-center rounded-md text-sm font-medium gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <UIcon name="i-lucide-list-checks" class="size-4" />
                <span>Todo's List</span>
              </NuxtLink>
            </div>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Sidebar: Collapsed Navigation</p>
            <div class="space-y-2 flex justify-center">
              <div class="space-y-2">
                <NuxtLink to="/daily-ops" class="flex items-center rounded-md text-sm font-medium justify-center p-2 bg-gray-200 text-gray-900 transition-colors">
                  <UIcon name="i-lucide-layout-dashboard" class="size-4" />
                </NuxtLink>
                <NuxtLink to="/notes" class="flex items-center rounded-md text-sm font-medium justify-center p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                  <UIcon name="i-lucide-file-text" class="size-4" />
                </NuxtLink>
                <NuxtLink to="/todos" class="flex items-center rounded-md text-sm font-medium justify-center p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                  <UIcon name="i-lucide-list-checks" class="size-4" />
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Settings Tabs -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Settings Pages: Tab Group (border-black, width-auto)</p>
          <div class="inline-flex shrink-0 rounded-md border border-black bg-white p-0.5">
            <button type="button" class="rounded px-3 py-1.5 text-sm font-medium transition-colors bg-gray-900 text-white">
              Credentials
            </button>
            <button type="button" class="rounded px-3 py-1.5 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100">
              Cron Jobs
            </button>
          </div>
        </div>
      </section>

      <!-- UButton Styles -->
      <section class="mb-16">
        <p class="text-xs uppercase font-semibold text-gray-500 mb-4">All Pages: UButton Component (All Variants)</p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-3">
            <p class="text-xs text-gray-600 font-semibold">Primary (gray-900)</p>
            <UButton class="bg-gray-900! text-white! w-full">Solid</UButton>
            <UButton variant="soft" class="bg-gray-100! text-gray-900! w-full">Soft</UButton>
            <UButton variant="outline" class="border-2! border-gray-900! w-full">Outline</UButton>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-3">
            <p class="text-xs text-gray-600 font-semibold">Other States</p>
            <UButton variant="ghost" class="w-full">Ghost</UButton>
            <UButton color="red" variant="soft" class="w-full">Destructive</UButton>
            <UButton :disabled="true" class="bg-gray-900! text-white! w-full">Disabled</UButton>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-3">
            <p class="text-xs text-gray-600 font-semibold">Sizes</p>
            <UButton size="sm" class="bg-gray-900! text-white! w-full">Small</UButton>
            <UButton size="md" class="bg-gray-900! text-white! w-full">Medium</UButton>
            <UButton size="lg" class="bg-gray-900! text-white! w-full">Large</UButton>
          </div>
        </div>
      </section>

      <!-- Icon Buttons -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Menu Builder: Icon Buttons</p>
          <div class="flex gap-2">
            <button type="button" class="p-1.5 rounded hover:bg-red-50 hover:text-red-600 transition-colors">
              <UIcon name="i-lucide-trash-2" class="size-4 text-gray-400" />
            </button>
            <button type="button" class="p-1.5 rounded hover:bg-red-50 hover:text-red-600 transition-colors">
              <UIcon name="i-lucide-x" class="size-4 text-gray-400" />
            </button>
            <button type="button" class="p-1.5 rounded hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <UIcon name="i-lucide-copy" class="size-4 text-gray-400" />
            </button>
            <button type="button" class="p-1.5 rounded hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <UIcon name="i-lucide-download" class="size-4 text-gray-400" />
            </button>
          </div>
        </div>
      </section>

      <!-- Soft Segmented (Todos) -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Todos Page: Soft Segmented Control</p>
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
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Note Editor: Tab Group (border-black)</p>
          <div class="inline-flex shrink-0 rounded-md border border-black bg-white p-0.5">
            <button type="button" class="rounded px-3 py-1.5 text-sm font-medium transition-colors bg-gray-900 text-white">
              Details
            </button>
            <button type="button" class="rounded px-3 py-1.5 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100">
              Todo
            </button>
            <button type="button" class="rounded px-3 py-1.5 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100">
              Agreed
            </button>
          </div>
        </div>
      </section>

      <!-- Marketing Tiles -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Menu Products: Marketing Tiles</p>
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
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Member Pages: Team Chips (11px)</p>
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
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Organisation: Status Badges (10px)</p>
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
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Menu Products Upload: Drag Zone</p>
          <div class="border-2 border-dashed border-primary-500 bg-primary-50 rounded-lg p-8 text-center">
            <p class="text-sm text-gray-600">Drag files here</p>
          </div>
        </div>
      </section>

      <!-- Form Focus State -->
      <section class="mb-16">
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">All Forms: Focus State (blue-500)</p>
          <input type="text" placeholder="Focus me..." class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" />
        </div>
      </section>

      <!-- Typography Examples -->
      <section class="mb-16">
        <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Typography Sizes</p>
        <div class="space-y-4">
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p style="font-size: 38px" class="font-extrabold tracking-[-0.02em] text-gray-900">Hero 38px</p>
          </div>
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p style="font-size: 34px" class="font-extrabold tracking-[-0.02em] text-gray-900">Section 34px</p>
          </div>
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-5xl font-bold text-gray-900">Note Title text-5xl</p>
          </div>
        </div>
      </section>

      <!-- Member Profile Card -->
      <section>
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <p class="text-xs uppercase font-semibold text-gray-500 mb-4">Member Pages: Profile Card (with Gradient)</p>
          <div class="rounded-lg overflow-hidden bg-linear-to-br from-[hsl(45,20%,99%)] to-[hsl(45,25%,82%)] border-2 border-[hsl(45,25%,82%)] p-6 mb-4">
            <p class="text-lg font-bold text-gray-900 mb-2">Member Name</p>
            <p class="text-sm text-gray-600">Active since 2024</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span style="font-size: 11px" class="uppercase tracking-wide font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded">Team</span>
            <span style="font-size: 11px" class="uppercase tracking-wide font-medium bg-sky-50 text-sky-700 px-2 py-1 rounded">Role</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// No reactive state needed - all examples are static
</script>
