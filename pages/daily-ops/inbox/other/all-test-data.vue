<template>
  <InboxPageShell
    title="All test data"
    description="Jump to a collection populated by inbox imports."
  >
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="rounded-lg border-2 border-gray-900 bg-white p-4 transition-colors hover:bg-gray-50"
      >
        <p class="font-semibold text-gray-900">{{ l.label }}</p>
        <p class="mt-1 font-mono text-xs text-gray-500">{{ l.collection }}</p>
      </NuxtLink>
    </div>
  </InboxPageShell>
</template>

<script setup lang="ts">
const links = [
  { to: '/daily-ops/inbox/bork/sales', label: 'Bork sales', collection: 'test-bork-sales' },
  { to: '/daily-ops/inbox/bork/product-mix', label: 'Product mix', collection: 'test-bork-product-mix' },
  { to: '/daily-ops/inbox/bork/food-beverage', label: 'Food & beverage', collection: 'test-bork-food-beverage' },
  { to: '/daily-ops/inbox/bork/basis-report', label: 'Basis report', collection: 'test-basis-report' },
  { to: '/daily-ops/inbox/bork/sales-per-hour', label: 'Sales per hour', collection: 'test-bork-basis-rapport' },
  { to: '/daily-ops/inbox/eitje/hours', label: 'Eitje hours', collection: 'test-eitje-hours' },
  { to: '/daily-ops/inbox/eitje/contracts', label: 'Eitje contracts', collection: 'test-eitje-contracts' },
  { to: '/daily-ops/inbox/eitje/finance', label: 'Eitje finance', collection: 'test-eitje-finance' },
  { to: '/daily-ops/inbox/power-bi/reports', label: 'Power BI exports', collection: 'power_bi_exports' },
]
</script>
