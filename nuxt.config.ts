/** Set `DISABLE_INBOX_SCHEDULED=1` locally to skip Gmail poll when Mongo is offline. */
const disableInboxSchedule = process.env.DISABLE_INBOX_SCHEDULED === '1'
/** Set `DISABLE_INTEGRATIONS_SCHEDULED=1` locally to skip Bork/Eitje Nitro cron (same as DISABLE_INBOX pattern). */
const disableIntegrationsSchedule = process.env.DISABLE_INTEGRATIONS_SCHEDULED === '1'

const scheduledTasks: Record<string, string[]> = {}
if (!disableInboxSchedule) {
  scheduledTasks['0 8 * * *'] = ['inbox:gmail-sync']
}
if (!disableIntegrationsSchedule) {
  /** Same UTC slots as `.github/workflows/daily-ops-sync.yml` — disable that workflow `schedule` to avoid duplicate API load. */
  scheduledTasks['0 6,13,16,18,20,22 * * *'] = ['integrations:bork-eitje-daily']
}

export default defineNuxtConfig({
  ssr: false,
  /** Sales-V2 API (`/api/sales-aggregated-v2`) — version suffix (default `_v2`). */
  runtimeConfig: {
    borkAggVersionSuffix: process.env.BORK_AGG_VERSION_SUFFIX ?? process.env.BORK_AGG_V2_SUFFIX ?? '_v2',
    borkAggV2Suffix: process.env.BORK_AGG_V2_SUFFIX ?? '',
  },
  modules: ['@nuxt/ui'],
  srcDir: '.',
  /** Avoid trailing slash — prevents bad joins like `.nuxt//dist` in generated dev paths. */
  buildDir: '.nuxt',
  css: ['~/assets/css/main.css'],
  devServer: {
    port: 8080,
  },
  compatibilityDate: '2026-03-12',
  ui: {
    colorMode: false,
  },
  vite: {
    optimizeDeps: {
      include: ['d3'],
    },
    /** Warm common entry files so `client.manifest.mjs` exists before first browser hit (reduces dev race). */
    server: {
      warmup: {
        clientFiles: ['./app.vue', './pages/daily-ops/inbox/index.vue'],
      },
    },
  },
  /**
   * Inbox Gmail poll: one run per day on the DO Node process (no extra DO Job component).
   * `0 8 * * *` UTC ≈ 10:00 Europe/Amsterdam in CEST (UTC+2). In CET (winter) same cron is ~09:00 local — adjust if needed.
   * GitHub inbox-daily-sync.yml is manual-only to avoid duplicate fetches + Actions minutes.
   *
   * Bork + Eitje: Nitro `0 6,13,16,18,20,22 * * *` UTC matches daily-ops-sync.yml; turn off that workflow schedule when this is on.
   * Startup catch-up: `INTEGRATION_SYNC_CATCHUP_ON_START` (production default on unless set to 0) + `INTEGRATION_SYNC_STALE_MS`.
   */
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks,
  },
})
