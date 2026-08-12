<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex justify-end"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/25"
        aria-label="Close info panel"
        @click="$emit('close')"
      />
      <aside
        class="relative z-10 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl"
        role="dialog"
        aria-labelledby="budget-info-title"
      >
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2
            id="budget-info-title"
            class="text-sm font-semibold text-gray-900"
          >
            How to read this budget
          </h2>
          <UButton
            type="button"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            aria-label="Close"
            @click="$emit('close')"
          />
        </div>
        <div class="flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm text-gray-700">
          <section class="space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">
              The simple idea
            </h3>
            <p>
              We want every month to keep about <strong>10% of sales as profit</strong>.
              The other 90% is what you may spend — your <strong>cost budget</strong>.
            </p>
          </section>

          <section class="space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Food &amp; drinks (COGS)
            </h3>
            <p>
              Aim for about <strong>25% of sales</strong> on food &amp; drinks
              (menu priced at margin 4: sell for 4× cost).
            </p>
          </section>

          <section class="space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Fixed vs flex
            </h3>
            <p>
              After food &amp; drinks, the rest of the cost budget pays
              <strong>fixed staff</strong> and <strong>overhead</strong>.
              What is left is the <strong>flex budget</strong> — money for flexible hours.
              If flex is negative, fixed costs already ate the pot; cut costs or grow sales.
            </p>
          </section>

          <section class="space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Seasons (±%)
            </h3>
            <p>
              Sales are not flat. History shows winter quieter, spring building, summer steady,
              autumn easing, December strong. The <strong>±%</strong> next to a season or month
              compares it to your <strong>year average</strong> (or to that season’s average).
            </p>
          </section>

          <section class="space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Weeks
            </h3>
            <p>
              Each week is <strong>1/4 of the month</strong> — same split Staff Org uses —
              so weekly planning matches monthly envelopes.
            </p>
          </section>

          <section class="space-y-1">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Inputs (per venue)
            </h3>
            <ul class="list-disc space-y-1 pl-4">
              <li><strong>Seasonal / trend</strong> — use sealed history shape scaled to your target average.</li>
              <li><strong>±% season</strong> — same shape, then bump or cut every month by that %.</li>
              <li><strong>Target avg €/mo</strong> — the year-average sales you are planning around.</li>
              <li><strong>Horizon</strong> — how many upcoming months to show.</li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * @registry-id: PnlBudgetInfoSheet
 * @created: 2026-08-12T01:50:00.000Z
 * @last-modified: 2026-08-12T01:50:00.000Z
 * @description: Plain-language side panel explaining Budget/Forecast metrics
 * @last-fix: [2026-08-12] Initial info sheet for Finance Budget page
 * @adr-ref: ADR-019, ADR-022
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/budget.vue
 */
defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()
</script>
