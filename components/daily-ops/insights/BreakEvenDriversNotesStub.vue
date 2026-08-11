<template>
  <!--
    WIP: not mounted on Insights page yet.
    Notes SSOT: dev-docs/insights/break-even-drivers-notes.md
    Wire later from DailyOpsPerformanceInsights / InsightsAnalyticsNav.
  -->
  <section class="rounded-lg border border-dashed border-amber-600/50 bg-amber-50/40 p-4 text-sm text-gray-800">
    <h2 class="text-base font-semibold text-gray-900">
      Break-even drivers (draft)
    </h2>
    <p class="mt-1 text-gray-600">
      Placeholder for Insights. Full write-up lives in
      <code class="text-xs">dev-docs/insights/break-even-drivers-notes.md</code>.
    </p>
    <ul class="mt-3 list-disc space-y-1 pl-5 text-gray-700">
      <li>€179k = rolling fixed÷CM, not average revenue.</li>
      <li>Past months use that month’s BE (e.g. Apr ’25 VK ≈ €146k → +€16k profit).</li>
      <li>Drivers: flex/inhuur CM squeeze, higher fixed OH, softer 2026 revenue.</li>
      <li>Need 2025 lonen FT/flex lines + clean Dec ’25 to harden the rollup.</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/**
 * @registry-id: insightsBreakEvenDriversNotesStub
 * @created: 2026-08-11T00:20:00.000Z
 * @last-modified: 2026-08-11T00:20:00.000Z
 * @description: Draft Insights stub for BE drivers narrative (not wired yet)
 * @last-fix: [2026-08-11] Drop-in stub + pointer to break-even-drivers-notes.md
 * @adr-ref: ADR-019, ADR-022, PERIOD_CACHE_ADR L4
 *
 * @exports-to:
 * ✓ components/daily-ops/insights/DailyOpsPerformanceInsights.vue
 */
</script>
