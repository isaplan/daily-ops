<template>
  <UApp>
    <div class="flex h-screen w-screen min-w-0 overflow-hidden">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </UApp>
</template>

<script setup lang="ts">
import { useHead } from '#app'

useHead({
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5',
  link: [
    { rel: 'manifest', href: '/manifest.json' },
    { rel: 'apple-touch-icon', href: '/logo.svg' },
    { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
    { rel: 'icon', type: 'image/png', href: '/icons/icon-192x192.png' },
  ],
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'DO Teams' },
    { name: 'theme-color', content: '#3C1D91' },
    { name: 'description', content: 'Daily Operations Management - Restaurant & Bar Operations Hub' },
  ],
})
</script>

