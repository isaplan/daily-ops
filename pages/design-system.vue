<template>
  <div class="min-h-screen bg-[hsl(45,15%,95%)] p-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-12">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">Design System</h1>
        <p class="text-lg text-gray-600">Nuxt UI v4 + Tailwind CSS v4 • Complete Pattern Reference</p>
      </div>

      <!-- Colors Section -->
      <section class="mb-16">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Colors</h2>
        
        <div class="space-y-8">
          <!-- Primary Palette -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Primary Palette</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="shade in primaryShades" :key="shade.name" class="bg-white rounded-lg p-4 border border-gray-200">
                <div :class="['w-full h-24 rounded-md mb-3', shade.bg]"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">{{ shade.name }}</p>
                <p class="font-mono text-xs text-gray-500">{{ shade.value }}</p>
              </div>
            </div>
          </div>

          <!-- Gray Palette -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Gray Palette</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div v-for="shade in grayShades" :key="shade.name" class="bg-white rounded-lg p-4 border border-gray-200">
                <div :class="['w-full h-20 rounded-md mb-3', shade.bg]"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">{{ shade.name }}</p>
                <p class="font-mono text-xs text-gray-500">{{ shade.value }}</p>
              </div>
            </div>
          </div>

          <!-- Semantic Colors -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Semantic & Accent Colors</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-[hsl(45,15%,95%)]"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Page Background</p>
                <p class="font-mono text-xs text-gray-500">hsl(45, 15%, 95%)</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-[hsl(45,12%,92%)]"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Note Aside</p>
                <p class="font-mono text-xs text-gray-500">hsl(45, 12%, 92%)</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-white border-2 border-gray-200"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Surface</p>
                <p class="font-mono text-xs text-gray-500">white</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-gray-900"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Accent/Primary</p>
                <p class="font-mono text-xs text-gray-500">gray-900</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-blue-600"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Link Color</p>
                <p class="font-mono text-xs text-gray-500">blue-600</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-red-600"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Destructive</p>
                <p class="font-mono text-xs text-gray-500">red-600</p>
              </div>
            </div>
          </div>

          <!-- Feature Colors (Marketing) -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Feature Colors (Menu/Marketing)</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-blue-100"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Blue Tiles</p>
                <p class="font-mono text-xs text-gray-500">bg-blue-100 / text-blue-600</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-green-100"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Green Tiles</p>
                <p class="font-mono text-xs text-gray-500">bg-green-100 / text-green-600</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-emerald-50"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Team Chip (Emerald)</p>
                <p class="font-mono text-xs text-gray-500">bg-emerald-50</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-sky-50"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Team Chip (Sky)</p>
                <p class="font-mono text-xs text-gray-500">bg-sky-50</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Typography Section -->
      <section class="mb-16">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Typography</h2>
        
        <div class="space-y-6">
          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dashboard Hero (text-[38px])</p>
            <h1 style="font-size: 38px" class="font-extrabold tracking-[-0.02em] text-gray-900">Quarterly Revenue</h1>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-[38px] · font-extrabold · tracking-[-0.02em]</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Section Title (text-[34px])</p>
            <h2 style="font-size: 34px" class="font-extrabold tracking-[-0.02em] text-gray-900">Insights</h2>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-[34px] · font-extrabold · tracking-[-0.02em]</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Note Title (text-5xl)</p>
            <h1 class="text-5xl font-bold text-gray-900">Meeting Notes</h1>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-5xl · font-bold</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Heading 1</p>
            <h2 class="text-3xl font-semibold text-gray-900">The quick brown fox jumps over the lazy dog</h2>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-3xl · font-semibold</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Body</p>
            <p class="text-base text-gray-900">The quick brown fox jumps over the lazy dog</p>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-base</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Micro Badge / Chip (text-[11px])</p>
            <p style="font-size: 11px" class="text-gray-600 uppercase tracking-wide">Team member badge</p>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-[11px] · uppercase · tracking-wide</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mini Badge (text-[10px])</p>
            <p style="font-size: 10px" class="text-gray-600 uppercase font-semibold">Inactive</p>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-[10px] · uppercase · font-semibold</p>
          </div>
        </div>
      </section>

      <!-- Buttons Section -->
      <section class="mb-16">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Buttons & Controls</h2>
        
        <!-- Color Reference for Buttons -->
        <div class="bg-white rounded-lg p-6 border border-gray-200 mb-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">App Color Palette (in Buttons)</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div class="text-center">
              <div class="w-full h-16 rounded-lg bg-gray-900 mb-2"></div>
              <p class="font-mono text-xs font-semibold text-gray-900">Primary</p>
              <p class="font-mono text-xs text-gray-600">gray-900</p>
            </div>
            <div class="text-center">
              <div class="w-full h-16 rounded-lg bg-gray-100 border border-gray-200 mb-2"></div>
              <p class="font-mono text-xs font-semibold text-gray-900">Secondary</p>
              <p class="font-mono text-xs text-gray-600">gray-100</p>
            </div>
            <div class="text-center">
              <div class="w-full h-16 rounded-lg bg-gray-200 mb-2"></div>
              <p class="font-mono text-xs font-semibold text-gray-900">Active Nav</p>
              <p class="font-mono text-xs text-gray-600">gray-200</p>
            </div>
            <div class="text-center">
              <div class="w-full h-16 rounded-lg bg-blue-600 mb-2"></div>
              <p class="font-mono text-xs font-semibold text-gray-900">Links</p>
              <p class="font-mono text-xs text-gray-600">blue-600</p>
            </div>
            <div class="text-center">
              <div class="w-full h-16 rounded-lg bg-red-600 mb-2"></div>
              <p class="font-mono text-xs font-semibold text-gray-900">Destructive</p>
              <p class="font-mono text-xs text-gray-600">red-600</p>
            </div>
          </div>
        </div>
        
        <div class="space-y-8">
          <!-- Button Variants -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">UButton Variants (with App Colors)</h3>
            <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-4">
              <div>
                <p class="text-sm text-gray-600 mb-3 font-semibold">Solid (Primary: gray-900)</p>
                <div class="flex flex-wrap gap-3">
                  <UButton variant="solid" class="bg-gray-900! text-white!">Solid Button</UButton>
                  <UButton variant="solid" class="bg-gray-900! text-white!" :disabled="true">Disabled</UButton>
                  <UButton variant="solid" class="bg-gray-900! text-white!" loading>Loading</UButton>
                </div>
              </div>
              <div class="border-t border-gray-200 pt-4">
                <p class="text-sm text-gray-600 mb-3 font-semibold">Soft (Secondary: gray-100)</p>
                <div class="flex flex-wrap gap-3">
                  <UButton variant="soft" class="bg-gray-100! text-gray-900!">Soft Button</UButton>
                  <UButton variant="soft" class="bg-gray-100! text-gray-900!" :disabled="true">Disabled</UButton>
                  <UButton variant="soft" class="bg-gray-100! text-gray-900!" loading>Loading</UButton>
                </div>
              </div>
              <div class="border-t border-gray-200 pt-4">
                <p class="text-sm text-gray-600 mb-3 font-semibold">Outline (border-gray-900)</p>
                <div class="flex flex-wrap gap-3">
                  <UButton variant="outline" class="border-2! border-gray-900!">Outline Button</UButton>
                  <UButton variant="outline" class="border-2! border-gray-900!" :disabled="true">Disabled</UButton>
                  <UButton variant="outline" class="border-2! border-gray-900!" loading>Loading</UButton>
                </div>
              </div>
              <div class="border-t border-gray-200 pt-4">
                <p class="text-sm text-gray-600 mb-3 font-semibold">Ghost (text-gray-900)</p>
                <div class="flex flex-wrap gap-3">
                  <UButton variant="ghost">Ghost Button</UButton>
                  <UButton variant="ghost" :disabled="true">Disabled</UButton>
                  <UButton variant="ghost" loading>Loading</UButton>
                </div>
              </div>
              <div class="border-t border-gray-200 pt-4">
                <p class="text-sm text-gray-600 mb-3 font-semibold">Destructive (red-600)</p>
                <div class="flex flex-wrap gap-3">
                  <UButton color="red" variant="soft">Delete</UButton>
                  <UButton color="red" variant="outline">Remove</UButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Button Sizes -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Sizes</h3>
            <div class="bg-white rounded-lg p-6 border border-gray-200">
              <div class="flex flex-wrap items-center gap-4">
                <div class="flex flex-col gap-2">
                  <p class="text-sm text-gray-600 font-semibold">XS</p>
                  <UButton size="xs">Extra Small</UButton>
                </div>
                <div class="flex flex-col gap-2">
                  <p class="text-sm text-gray-600 font-semibold">SM</p>
                  <UButton size="sm">Small</UButton>
                </div>
                <div class="flex flex-col gap-2">
                  <p class="text-sm text-gray-600 font-semibold">MD (default)</p>
                  <UButton size="md">Medium</UButton>
                </div>
                <div class="flex flex-col gap-2">
                  <p class="text-sm text-gray-600 font-semibold">LG</p>
                  <UButton size="lg">Large</UButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Segmented Controls (Primary Pattern) -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Segmented Controls (Primary Pattern)</h3>
            <p class="text-sm text-gray-600 mb-3">Black-bordered pill groups used throughout Daily Ops dashboard</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-4">
              <!-- Time period selector -->
              <div>
                <p class="text-sm text-gray-500 mb-2">Period Toggle (font-semibold)</p>
                <div class="inline-flex max-w-max flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
                  <NuxtLink to="#" class="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-semibold transition-colors">Today</NuxtLink>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold transition-colors">This Week</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold transition-colors">This Month</button>
                </div>
              </div>

              <!-- Dashboard sections -->
              <div>
                <p class="text-sm text-gray-500 mb-2">Dashboard Section Nav (font-semibold)</p>
                <div class="inline-flex max-w-max flex-wrap gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
                  <button type="button" class="bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-semibold transition-colors">Daily Ops</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-4 py-1.5 rounded text-sm font-semibold transition-colors">Revenue</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-4 py-1.5 rounded text-sm font-semibold transition-colors">Productivity</button>
                </div>
              </div>

              <!-- Inbox with shadow -->
              <div>
                <p class="text-sm text-gray-500 mb-2">Inbox Toolbar (with shadow)</p>
                <div class="inline-flex max-w-max flex-wrap gap-1 rounded-md border-2 border-gray-900 bg-white p-1" style="box-shadow: 2px 2px 0 0 rgba(0,0,0,0.08)">
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold transition-colors">Gmail</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold transition-colors">Sync</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold transition-colors">Process</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar Navigation -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Navigation Links (Sidebar Pattern)</h3>
            <p class="text-sm text-gray-600 mb-3">Soft gray pills used in sidebar and page nav</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-2">
              <NuxtLink to="#" class="flex items-center rounded-md text-sm font-medium px-3 py-2 gap-3 bg-gray-200 text-gray-900 transition-colors">
                <UIcon name="i-lucide-layout-dashboard" class="size-4" />
                <span>Dashboard</span>
              </NuxtLink>
              <NuxtLink to="#" class="flex items-center rounded-md text-sm font-medium px-3 py-2 gap-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <UIcon name="i-lucide-file-text" class="size-4" />
                <span>All Notes</span>
              </NuxtLink>
              <NuxtLink to="#" class="flex items-center rounded-md text-sm font-medium px-3 py-2 gap-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <UIcon name="i-lucide-list-checks" class="size-4" />
                <span>Todo's List</span>
              </NuxtLink>
            </div>
          </div>

          <!-- TabRail (settings, todos, note aside — same component) -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">TabRail</h3>
            <p class="text-sm text-gray-600 mb-3">
              Shared component <code class="text-xs">components/ui/TabRail.vue</code> — API settings (Credentials / Cron Jobs), Todo's List (All / My todo's), note editor aside (Details / Todo / Agreed).
            </p>
            <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-6">
              <div>
                <p class="text-xs font-semibold text-gray-500 mb-2">API settings</p>
                <UiTabRail v-model="dsTabRailSettings" :options="dsTabRailSettingsOpts" />
              </div>
              <div>
                <p class="text-xs font-semibold text-gray-500 mb-2">Todo's List</p>
                <UiTabRail v-model="dsTabRailTodos" :options="dsTabRailTodosOpts" />
              </div>
              <div>
                <p class="text-xs font-semibold text-gray-500 mb-2">Note aside</p>
                <UiTabRail v-model="dsTabRailNote" :options="dsTabRailNoteOpts" />
              </div>
            </div>
          </div>

          <!-- PillTabs (compact venue/context switcher) -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">PillTabs</h3>
            <p class="text-sm text-gray-600 mb-3">
              Shared component <code class="text-xs">components/ui/PillTabs.vue</code> — compact rounded tabs for carousel/section context switching.
            </p>
            <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-6">
              <div>
                <p class="text-xs font-semibold text-gray-500 mb-2">Venue carousel selector</p>
                <UiPillTabs
                  v-model="dsPillVenue"
                  :options="dsPillVenueOpts"
                  aria-label="Select venue"
                />
              </div>
              <div>
                <p class="text-xs font-semibold text-gray-500 mb-2">Compact status selector</p>
                <UiPillTabs
                  v-model="dsPillStatus"
                  :options="dsPillStatusOpts"
                  aria-label="Select status"
                />
              </div>
            </div>
          </div>

          <!-- Menu / Marketing Tiles -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Marketing Tiles (Menu)</h3>
            <p class="text-sm text-gray-600 mb-3">Colored icon wells with hover states</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200">
              <div class="flex flex-wrap gap-4">
                <a href="#" class="w-32 p-4 rounded-lg bg-blue-100 text-blue-600 border border-blue-100 hover:border-primary-300 transition-colors text-center">
                  <div class="text-3xl mb-2">📋</div>
                  <p class="text-xs font-medium">Menu List</p>
                </a>
                <a href="#" class="w-32 p-4 rounded-lg bg-green-100 text-green-600 border border-green-100 hover:border-primary-300 transition-colors text-center">
                  <div class="text-3xl mb-2">🎯</div>
                  <p class="text-xs font-medium">Specials</p>
                </a>
              </div>
            </div>
          </div>

          <!-- Icon Buttons with Hover -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Icon Buttons (Menu Builder)</h3>
            <p class="text-sm text-gray-600 mb-3">Micro pills and destructive red-hover patterns</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-4">
              <div>
                <p class="text-sm text-gray-500 mb-2">Gray Pill Buttons (text-xs)</p>
                <div class="flex flex-wrap gap-2">
                  <span class="text-xs font-medium text-gray-700 bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 cursor-default">Filter 1</span>
                  <span class="text-xs font-medium text-gray-700 bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 cursor-default">Filter 2</span>
                </div>
              </div>
              <div class="border-t border-gray-200 pt-4">
                <p class="text-sm text-gray-500 mb-2">Red-Hover Icon Buttons</p>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="p-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors">
                    <UIcon name="i-lucide-trash-2" class="size-4 text-gray-400" />
                  </button>
                  <button type="button" class="p-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors">
                    <UIcon name="i-lucide-x" class="size-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Upload Drag State -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Upload Drop Zone (Menu Products)</h3>
            <p class="text-sm text-gray-600 mb-3">Primary dashed border on drag, blue selection panel</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-4">
              <div class="border-2 border-dashed border-primary-500 bg-primary-50 rounded-lg p-8 text-center">
                <p class="text-sm text-gray-600 mb-2">Drag files here or click to upload</p>
                <p class="text-xs text-gray-500">Dashed primary border (border-primary-500) + bg-primary-50</p>
              </div>
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p class="text-xs text-blue-600 font-medium mb-2">Selection Queue</p>
                <p class="text-xs text-gray-600">File list panel with blue background</p>
              </div>
            </div>
          </div>

          <!-- Member Profile Card -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Member Profile Card</h3>
            <p class="text-sm text-gray-600 mb-3">Gradient header with emerald/sky team chips</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200">
              <div class="rounded-lg overflow-hidden bg-linear-to-br from-[hsl(45,20%,99%)] to-[hsl(45,25%,82%)] border-2 border-[hsl(45,25%,82%)] p-6 mb-4">
                <p class="text-lg font-bold text-gray-900 mb-2">Team Member</p>
                <p class="text-sm text-gray-600">Active since 2024</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <span class="text-[11px] uppercase tracking-wide font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded">Team A</span>
                <span class="text-[11px] uppercase tracking-wide font-medium bg-sky-50 text-sky-700 px-2 py-1 rounded">Team B</span>
              </div>
            </div>
          </div>

          <!-- CTA Patterns -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">CTA Patterns</h3>
            <p class="text-sm text-gray-600 mb-3">Primary-filled vs black-filled actions</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200 flex flex-wrap gap-4">
              <a href="#" class="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                <UIcon name="i-lucide-plus" class="inline mr-2 size-4" />
                Create (Primary)
              </a>
              <UButton class="bg-gray-900!">
                <UIcon name="i-lucide-save" class="inline mr-2 size-4" />
                Save (Gray-900)
              </UButton>
            </div>
          </div>
        </div>
      </section>

      <!-- Summary Section -->
      <section>
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Design System Summary</h2>
        
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Button Patterns by Area</h3>
          <div class="space-y-4">
            <div class="border-l-4 border-gray-900 pl-4">
              <p class="font-semibold text-gray-900">Daily Ops Dashboard</p>
              <p class="text-sm text-gray-600">Segmented controls (border-2 border-gray-900, font-semibold), hard cards (border-2 border-gray-900), large hero text (text-[38px], text-[34px])</p>
            </div>
            <div class="border-l-4 border-blue-600 pl-4">
              <p class="font-semibold text-gray-900">Notes / Projects</p>
              <p class="text-sm text-gray-600">Warm backgrounds (hsl(45,...)), border-black tabs, text-5xl titles, soft gray navigation</p>
            </div>
            <div class="border-l-4 border-green-600 pl-4">
              <p class="font-semibold text-gray-900">Menu / Products</p>
              <p class="text-sm text-gray-600">Marketing tiles (blue-100, green-100), upload drag states (primary-500 dashed), micro badges</p>
            </div>
            <div class="border-l-4 border-amber-600 pl-4">
              <p class="font-semibold text-gray-900">Menu Builder V2</p>
              <p class="text-sm text-gray-600">Micro gray pills (text-xs), red-hover icon buttons, neutral ghost controls</p>
            </div>
            <div class="border-l-4 border-purple-600 pl-4">
              <p class="font-semibold text-gray-900">Member Pages</p>
              <p class="text-sm text-gray-600">Gradient profile cards, emerald/sky team chips (text-[11px]), blue links</p>
            </div>
          </div>

          <h3 class="text-lg font-semibold text-gray-900 mb-4 mt-8">Key Design Tokens (with Examples)</h3>
          <div class="space-y-6">
            <!-- Primary Action -->
            <div class="border-l-4 border-gray-900 pl-4 py-4">
              <p class="font-semibold text-gray-900 mb-3">Primary Action</p>
              <p class="text-sm text-gray-600 mb-3">gray-900 (black) with font-semibold, border-2 border-gray-900 for segmented controls</p>
              <div class="bg-gray-50 rounded-md p-4 space-y-2">
                <div class="inline-flex gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
                  <button type="button" class="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-semibold">Primary</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold">Secondary</button>
                </div>
              </div>
            </div>

            <!-- Secondary Action -->
            <div class="border-l-4 border-gray-200 pl-4 py-4">
              <p class="font-semibold text-gray-900 mb-3">Secondary Action</p>
              <p class="text-sm text-gray-600 mb-3">Soft gray (bg-gray-100, bg-gray-200) with font-medium for nav/sidebar</p>
              <div class="bg-gray-50 rounded-md p-4 space-y-2">
                <NuxtLink to="#" class="inline-flex items-center rounded-md text-sm font-medium px-3 py-2 gap-2 bg-gray-200 text-gray-900">
                  <UIcon name="i-lucide-home" class="size-4" />
                  Active
                </NuxtLink>
                <NuxtLink to="#" class="inline-flex items-center rounded-md text-sm font-medium px-3 py-2 gap-2 text-gray-600 hover:bg-gray-100">
                  <UIcon name="i-lucide-file" class="size-4" />
                  Inactive
                </NuxtLink>
              </div>
            </div>

            <!-- Focus States -->
            <div class="border-l-4 border-blue-500 pl-4 py-4">
              <p class="font-semibold text-gray-900 mb-3">Focus States</p>
              <p class="text-sm text-gray-600 mb-3">Blue-500 focus rings (focus:ring-blue-500 focus:border-blue-500) on forms and inputs</p>
              <div class="bg-gray-50 rounded-md p-4">
                <input type="text" placeholder="Focus on me..." class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" />
              </div>
            </div>

            <!-- Destructive -->
            <div class="border-l-4 border-red-600 pl-4 py-4">
              <p class="font-semibold text-gray-900 mb-3">Destructive</p>
              <p class="text-sm text-gray-600 mb-3">Red-600 for delete buttons, red-50 hover backgrounds for icon buttons</p>
              <div class="bg-gray-50 rounded-md p-4 space-y-2">
                <UButton color="red" variant="soft" size="sm">Delete Item</UButton>
                <div class="flex gap-2">
                  <button type="button" class="p-1.5 rounded hover:bg-red-50 hover:text-red-600 transition-colors">
                    <UIcon name="i-lucide-trash-2" class="size-4 text-gray-400" />
                  </button>
                  <button type="button" class="p-1.5 rounded hover:bg-red-50 hover:text-red-600 transition-colors">
                    <UIcon name="i-lucide-x" class="size-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Links -->
            <div class="border-l-4 border-blue-600 pl-4 py-4">
              <p class="font-semibold text-gray-900 mb-3">Links</p>
              <p class="text-sm text-gray-600 mb-3">blue-600 for standard links, text-primary-600 for primary CTAs</p>
              <div class="bg-gray-50 rounded-md p-4 space-y-2">
                <a href="#" class="text-blue-600 hover:text-blue-800 text-sm block">← Back to list (blue-600)</a>
                <a href="#" class="text-primary-600 hover:text-primary-700 text-sm font-medium block">Create new item (text-primary-600)</a>
              </div>
            </div>

            <!-- Typography -->
            <div class="border-l-4 border-purple-600 pl-4 py-4">
              <p class="font-semibold text-gray-900 mb-3">Typography</p>
              <p class="text-sm text-gray-600 mb-3">Overline 10px, micro 11px, regular sizes (sm/base/lg), display sizes (34px/38px)</p>
              <div class="bg-gray-50 rounded-md p-4 space-y-2">
                <p style="font-size: 10px" class="text-gray-600 uppercase font-semibold">Overline (10px)</p>
                <p style="font-size: 11px" class="text-gray-600 uppercase tracking-wide">Micro Badge (11px)</p>
                <p class="text-sm text-gray-600">Small (text-sm)</p>
                <p class="text-base text-gray-600">Regular (text-base)</p>
                <p style="font-size: 34px" class="font-extrabold tracking-[-0.02em] text-gray-900">Section Title (34px)</p>
              </div>
            </div>

            <!-- Backgrounds -->
            <div class="border-l-4 border-amber-600 pl-4 py-4">
              <p class="font-semibold text-gray-900 mb-3">Backgrounds</p>
              <p class="text-sm text-gray-600 mb-3">Page: hsl(45,15%,95%), Note aside: hsl(45,12%,92%), feature marketing: blue-100/green-100</p>
              <div class="space-y-2">
                <div class="bg-[hsl(45,15%,95%)] border border-gray-200 rounded-md p-4 h-16 flex items-center justify-center">
                  <p class="text-sm text-gray-600">Page bg: hsl(45,15%,95%)</p>
                </div>
                <div class="bg-[hsl(45,12%,92%)] border border-gray-200 rounded-md p-4 h-16 flex items-center justify-center">
                  <p class="text-sm text-gray-600">Note aside: hsl(45,12%,92%)</p>
                </div>
                <div class="flex gap-2">
                  <div class="bg-blue-100 border border-blue-200 rounded-md p-4 h-16 flex items-center justify-center flex-1">
                    <p class="text-xs text-blue-600 font-medium">Feature: blue-100</p>
                  </div>
                  <div class="bg-green-100 border border-green-200 rounded-md p-4 h-16 flex items-center justify-center flex-1">
                    <p class="text-xs text-green-600 font-medium">Feature: green-100</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h3 class="text-lg font-semibold text-gray-900 mb-4 mt-8">Foundation</h3>
          <div class="space-y-2 text-gray-900">
            <p><span class="font-semibold">Framework:</span> Nuxt 4 with Vue 3</p>
            <p><span class="font-semibold">UI Library:</span> Nuxt UI v4</p>
            <p><span class="font-semibold">Styling:</span> Tailwind CSS v4</p>
            <p><span class="font-semibold">Strategy:</span> Context-specific patterns (segmented for dashboard, soft for nav, gradient for profiles)</p>
            <p><span class="font-semibold">Icons:</span> Lucide icons (i-lucide-* classes)</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const dsTabRailSettings = ref<'credentials' | 'cron-jobs'>('credentials')
const dsTabRailSettingsOpts: { value: 'credentials' | 'cron-jobs'; label: string }[] = [
  { value: 'credentials', label: 'Credentials' },
  { value: 'cron-jobs', label: 'Cron Jobs' },
]

const dsTabRailTodos = ref<'all' | 'mine'>('all')
const dsTabRailTodosOpts: { value: 'all' | 'mine'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: "My todo's" },
]

const dsTabRailNote = ref<'details' | 'todos' | 'agreed'>('details')
const dsTabRailNoteOpts: { value: 'details' | 'todos' | 'agreed'; label: string }[] = [
  { value: 'details', label: 'Details' },
  { value: 'todos', label: 'Todo' },
  { value: 'agreed', label: 'Agreed' },
]

const dsPillVenue = ref<'vkb' | 'bea' | 'lat'>('vkb')
const dsPillVenueOpts: { value: 'vkb' | 'bea' | 'lat'; label: string }[] = [
  { value: 'vkb', label: 'VKB' },
  { value: 'bea', label: 'BEA' },
  { value: 'lat', label: 'LAT' },
]

const dsPillStatus = ref<'open' | 'ready' | 'done'>('open')
const dsPillStatusOpts: { value: 'open' | 'ready' | 'done'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'ready', label: 'Ready' },
  { value: 'done', label: 'Done' },
]

const primaryShades = [
  { name: 'primary-50', bg: 'bg-primary-50', value: 'bg-primary-50' },
  { name: 'primary-100', bg: 'bg-primary-100', value: 'bg-primary-100' },
  { name: 'primary-200', bg: 'bg-primary-200', value: 'bg-primary-200' },
  { name: 'primary-300', bg: 'bg-primary-300', value: 'bg-primary-300' },
  { name: 'primary-400', bg: 'bg-primary-400', value: 'bg-primary-400' },
  { name: 'primary-500', bg: 'bg-primary-500', value: 'bg-primary-500' },
  { name: 'primary-600', bg: 'bg-primary-600', value: 'bg-primary-600' },
  { name: 'primary-700', bg: 'bg-primary-700', value: 'bg-primary-700' },
  { name: 'primary-800', bg: 'bg-primary-800', value: 'bg-primary-800' },
  { name: 'primary-900', bg: 'bg-primary-900', value: 'bg-primary-900' },
]

const grayShades = [
  { name: 'gray-50', bg: 'bg-gray-50', value: 'bg-gray-50' },
  { name: 'gray-100', bg: 'bg-gray-100', value: 'bg-gray-100' },
  { name: 'gray-200', bg: 'bg-gray-200', value: 'bg-gray-200' },
  { name: 'gray-300', bg: 'bg-gray-300', value: 'bg-gray-300' },
  { name: 'gray-400', bg: 'bg-gray-400', value: 'bg-gray-400' },
  { name: 'gray-500', bg: 'bg-gray-500', value: 'bg-gray-500' },
  { name: 'gray-600', bg: 'bg-gray-600 text-white', value: 'bg-gray-600' },
  { name: 'gray-700', bg: 'bg-gray-700 text-white', value: 'bg-gray-700' },
  { name: 'gray-800', bg: 'bg-gray-800 text-white', value: 'bg-gray-800' },
  { name: 'gray-900', bg: 'bg-gray-900 text-white', value: 'bg-gray-900' },
]
</script>
