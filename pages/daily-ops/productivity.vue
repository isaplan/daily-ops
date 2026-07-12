<script setup lang="ts">
/**
 * @registry-id: dailyOpsProductivityRedirect
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: 301 redirect to /staff/productivity
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-010, ADR-013
 * @data-source: none
 * @read-cache-json: none
 * @imports-data-from: none
 */
const route = useRoute()

await navigateTo(
  { path: '/daily-ops/staff/productivity', query: route.query },
  { redirectCode: 301 },
)
</script>
