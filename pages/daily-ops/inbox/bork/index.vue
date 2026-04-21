<template>
  <InboxPageShell
    title="Bork (Trivec)"
    description="Imported Bork CSV/Excel test extracts."
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
  { to: '/daily-ops/inbox/bork/sales', label: 'Sales', hint: 'inbox-bork-sales' },
  { to: '/daily-ops/inbox/bork/product-mix', label: 'Product mix', hint: 'inbox-bork-product-mix' },
  { to: '/daily-ops/inbox/bork/food-beverage', label: 'Food & beverage', hint: 'inbox-bork-food-beverage' },
  { to: '/daily-ops/inbox/bork/basis-report', label: 'Basis report', hint: 'inbox-bork-basis-report' },
  { to: '/daily-ops/inbox/bork/sales-per-hour', label: 'Sales per hour', hint: 'inbox-bork-sales-by-hour' },
]
</script>
