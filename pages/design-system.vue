<template>
  <div class="min-h-screen bg-[hsl(45,15%,95%)] p-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-12">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">Design System</h1>
        <p class="text-lg text-gray-600">Nuxt UI v4 + Tailwind CSS v4</p>
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
            <h3 class="text-lg font-medium text-gray-900 mb-4">Semantic Colors (in use)</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-[hsl(45,15%,95%)]"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Background</p>
                <p class="font-mono text-xs text-gray-500">hsl(45, 15%, 95%)</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-white border border-gray-200"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Surface</p>
                <p class="font-mono text-xs text-gray-500">white</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-gray-900"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Accent</p>
                <p class="font-mono text-xs text-gray-500">gray-900</p>
              </div>
              <div class="bg-white rounded-lg p-4 border border-gray-200">
                <div class="w-full h-20 rounded-md mb-3 bg-blue-600"></div>
                <p class="font-mono text-sm font-semibold text-gray-900">Link Color</p>
                <p class="font-mono text-xs text-gray-500">blue-600</p>
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
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Display</p>
            <h1 class="text-4xl font-bold text-gray-900">The quick brown fox jumps over the lazy dog</h1>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-4xl · font-bold</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Heading 1</p>
            <h2 class="text-3xl font-semibold text-gray-900">The quick brown fox jumps over the lazy dog</h2>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-3xl · font-semibold</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Heading 2</p>
            <h3 class="text-2xl font-semibold text-gray-900">The quick brown fox jumps over the lazy dog</h3>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-2xl · font-semibold</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Body Large</p>
            <p class="text-lg text-gray-900">The quick brown fox jumps over the lazy dog</p>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-lg</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Body</p>
            <p class="text-base text-gray-900">The quick brown fox jumps over the lazy dog</p>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-base</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Body Small</p>
            <p class="text-sm text-gray-900">The quick brown fox jumps over the lazy dog</p>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-sm</p>
          </div>

          <div class="bg-white rounded-lg p-6 border border-gray-200">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Caption</p>
            <p class="text-xs text-gray-600">The quick brown fox jumps over the lazy dog</p>
            <p class="text-sm text-gray-600 mt-2 font-mono">text-xs</p>
          </div>
        </div>

        <div class="mt-8 bg-white rounded-lg p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Font Stack</h3>
          <p class="text-base text-gray-900 mb-2"><span class="font-semibold">Default:</span> Tailwind system fonts</p>
          <p class="font-mono text-sm text-gray-600">ui-sans-serif, system-ui, sans-serif</p>
          <p class="text-base text-gray-900 mt-4 mb-2"><span class="font-semibold">Used in:</span> Exports, PDF documents</p>
        </div>
      </section>

      <!-- Buttons Section -->
      <section class="mb-16">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Buttons</h2>
        
        <div class="space-y-8">
          <!-- Button Variants -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Variants</h3>
            <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-4">
              <div>
                <p class="text-sm text-gray-600 mb-3 font-semibold">Solid</p>
                <div class="flex flex-wrap gap-3">
                  <UButton variant="solid">Solid Button</UButton>
                  <UButton variant="solid" :disabled="true">Disabled</UButton>
                  <UButton variant="solid" loading>Loading</UButton>
                </div>
              </div>
              <div class="border-t border-gray-200 pt-4">
                <p class="text-sm text-gray-600 mb-3 font-semibold">Soft</p>
                <div class="flex flex-wrap gap-3">
                  <UButton variant="soft">Soft Button</UButton>
                  <UButton variant="soft" :disabled="true">Disabled</UButton>
                  <UButton variant="soft" loading>Loading</UButton>
                </div>
              </div>
              <div class="border-t border-gray-200 pt-4">
                <p class="text-sm text-gray-600 mb-3 font-semibold">Outline</p>
                <div class="flex flex-wrap gap-3">
                  <UButton variant="outline">Outline Button</UButton>
                  <UButton variant="outline" :disabled="true">Disabled</UButton>
                  <UButton variant="outline" loading>Loading</UButton>
                </div>
              </div>
              <div class="border-t border-gray-200 pt-4">
                <p class="text-sm text-gray-600 mb-3 font-semibold">Ghost</p>
                <div class="flex flex-wrap gap-3">
                  <UButton variant="ghost">Ghost Button</UButton>
                  <UButton variant="ghost" :disabled="true">Disabled</UButton>
                  <UButton variant="ghost" loading>Loading</UButton>
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
                <div class="flex flex-col gap-2">
                  <p class="text-sm text-gray-600 font-semibold">XL</p>
                  <UButton size="xl">Extra Large</UButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Button with Icons -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">With Icons</h3>
            <div class="bg-white rounded-lg p-6 border border-gray-200 flex flex-wrap gap-3">
              <UButton leading-icon="i-lucide-arrow-left">Back</UButton>
              <UButton trailing-icon="i-lucide-arrow-right">Next</UButton>
              <UButton icon="i-lucide-plus">Add Item</UButton>
              <UButton icon="i-lucide-trash-2" variant="ghost" size="sm" />
            </div>
          </div>

          <!-- Button as Link -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">As Link</h3>
            <div class="bg-white rounded-lg p-6 border border-gray-200 flex flex-wrap gap-3">
              <UButton to="/">Navigate Home</UButton>
              <UButton to="/organisation" variant="soft">Go to Organisation</UButton>
            </div>
          </div>

          <!-- Segmented Control / Pill Group (Primary Pattern in App) -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Segmented Controls (Primary Pattern)</h3>
            <p class="text-sm text-gray-600 mb-3">Black-bordered pill groups used throughout Daily Ops dashboard</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200 space-y-4">
              <!-- Time period selector -->
              <div>
                <p class="text-sm text-gray-500 mb-2">Period Toggle</p>
                <div class="inline-flex max-w-max flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
                  <NuxtLink to="#" class="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors">Today</NuxtLink>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-medium transition-colors">This Week</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-medium transition-colors">This Month</button>
                </div>
              </div>

              <!-- Dashboard sections -->
              <div>
                <p class="text-sm text-gray-500 mb-2">Dashboard Section Nav</p>
                <div class="inline-flex max-w-max flex-wrap gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
                  <button type="button" class="bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors">Daily Ops</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-4 py-1.5 rounded text-sm font-medium transition-colors">Revenue</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-4 py-1.5 rounded text-sm font-medium transition-colors">Productivity</button>
                </div>
              </div>

              <!-- Location shortcuts -->
              <div>
                <p class="text-sm text-gray-500 mb-2">Location Shortcuts</p>
                <div class="inline-flex max-w-max flex-wrap gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
                  <button type="button" class="bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors">All</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-medium transition-colors">Amsterdam</button>
                  <button type="button" class="text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-medium transition-colors">Rotterdam</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar Navigation (Secondary Pattern) -->
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

          <!-- Settings Tabs (Tertiary Pattern) -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Settings Tabs (Underline Pattern)</h3>
            <p class="text-sm text-gray-600 mb-3">Bottom-border tabs used in settings pages</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200">
              <div class="flex gap-6 border-b border-gray-200">
                <button type="button" class="pb-2 text-sm font-medium text-gray-900 border-b-2 border-gray-900 transition-colors">Eitje API</button>
                <button type="button" class="pb-2 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-900 transition-colors">Bork API</button>
                <button type="button" class="pb-2 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-900 transition-colors">Webhooks</button>
              </div>
            </div>
          </div>

          <!-- Custom Button Wrapper -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Test Connection Button</h3>
            <p class="text-sm text-gray-600 mb-3">Custom wrapper component used in settings (outlined UButton with loading state and icon)</p>
            <div class="bg-white rounded-lg p-6 border border-gray-200 flex flex-wrap gap-3">
              <UButton variant="outline" loading>Testing...</UButton>
              <UButton variant="outline">Test Connection</UButton>
            </div>
          </div>
        </div>
      </section>

      <!-- Component Usage Section -->
      <section>
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Component Usage</h2>
        
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Primary Button Patterns</h3>
          <ul class="space-y-3 text-gray-900">
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">Segmented Controls</span>
              <span class="text-gray-600">Black-bordered pill groups (border-2 border-gray-900) used in Daily Ops dashboard for period selection, section navigation, and location shortcuts. Active item: bg-gray-900 text-white</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">Sidebar Navigation</span>
              <span class="text-gray-600">Soft gray pills (rounded-md) used in sidebar and page navigation. Active: bg-gray-200 text-gray-900. Inactive: text-gray-600 hover:bg-gray-100</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">Settings Tabs</span>
              <span class="text-gray-600">Bottom-border underline tabs (border-b-2) used in settings pages. Active: border-gray-900. Inactive: border-transparent</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">UButton</span>
              <span class="text-gray-600">Nuxt UI button with variants (solid, soft, outline, ghost), sizes (xs-xl). Often forced to !bg-gray-900 for consistency with segmented controls</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">TestConnectionButton</span>
              <span class="text-gray-600">Custom wrapper around UButton used in API settings with outline variant, leading icon, and loading state</span>
            </li>
          </ul>

          <h3 class="text-lg font-semibold text-gray-900 mb-4 mt-8">Color Scheme (Actual Usage)</h3>
          <ul class="space-y-3 text-gray-900">
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">Primary Action</span>
              <span class="text-gray-600">gray-900 (black) for selected/active states, buttons with strong emphasis</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">Secondary Action</span>
              <span class="text-gray-600">Soft gray backgrounds (gray-100, gray-200) for hover/inactive states</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">Navigation Text</span>
              <span class="text-gray-600">text-gray-600 for inactive, text-gray-900 for active</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">Borders</span>
              <span class="text-gray-600">gray-900 for strong dividers (segmented controls), gray-200 for subtle borders</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="font-semibold min-w-fit">Semantic</span>
              <span class="text-gray-600">blue-600 for links, red for destructive actions, success green for connected states</span>
            </li>
          </ul>

          <h3 class="text-lg font-semibold text-gray-900 mb-4 mt-8">Design System Foundation</h3>
          <div class="space-y-2 text-gray-900">
            <p><span class="font-semibold">Framework:</span> Nuxt 4 with Vue 3</p>
            <p><span class="font-semibold">UI Library:</span> Nuxt UI v4</p>
            <p><span class="font-semibold">Styling:</span> Tailwind CSS v4</p>
            <p><span class="font-semibold">Button Strategy:</span> Context-specific patterns (segmented for dashboard, soft for nav, underline for settings)</p>
            <p><span class="font-semibold">Theme Color Primary:</span> Semantic 'primary' from Nuxt UI, often overridden to gray-900</p>
            <p><span class="font-semibold">Icon Library:</span> Lucide icons (via i-lucide-* classes)</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
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
