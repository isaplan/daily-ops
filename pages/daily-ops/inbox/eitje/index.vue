<template>
  <InboxPageShell
    title="Eitje"
    description="Imported Eitje CSV data (hours, contracts, finance)."
  >
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="rounded-lg border-2 border-gray-900 bg-white p-4 transition-colors hover:bg-gray-50"
      >
        <p class="font-semibold text-gray-900">{{ l.label }}</p>
        <p class="mt-1 text-sm text-gray-600">{{ l.hint }}</p>
      </NuxtLink>
    </div>
  </InboxPageShell>
</template>

<script setup lang="ts">
const links = [
  { to: '/daily-ops/inbox/eitje/hours', label: 'Hours', hint: 'test-eitje-hours' },
  { to: '/daily-ops/inbox/eitje/contracts', label: 'Contracts', hint: 'test-eitje-contracts' },
  { to: '/daily-ops/inbox/eitje/finance', label: 'Finance', hint: 'test-eitje-finance' },
]
</script>
