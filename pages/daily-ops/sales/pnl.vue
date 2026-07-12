<script setup lang="ts">
/**
 * @registry-id: dailyOpsSalesPnl
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Sales P&L view
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-013
 * @data-source: direct-db
 * @read-cache-json: none
 * @imports-data-from: GET /api/sales/*
 */
await navigateTo('/daily-ops/finance/pnl', { redirectCode: 301 })
</script>
