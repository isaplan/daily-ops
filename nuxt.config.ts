/** Set `DISABLE_INBOX_SCHEDULED=1` locally to skip Gmail poll when Mongo is offline. */
const disableInboxSchedule = process.env.DISABLE_INBOX_SCHEDULED === '1'
/** Set `DISABLE_INTEGRATIONS_SCHEDULED=1` locally to skip Bork/Eitje Nitro cron (same as DISABLE_INBOX pattern). */
const disableIntegrationsSchedule = process.env.DISABLE_INTEGRATIONS_SCHEDULED === '1'

const scheduledTasks: Record<string, string[]> = {}
if (!disableInboxSchedule) {
  /**
   * Gmail inbox poll 3×/day **in Amsterdam CEST timezone** (local server clock).
   * 
   * **CRITICAL:** Cron expressions use the **server's local system timezone**, NOT UTC!
   * On this system (CEST/Amsterdam): these times run at exactly 08:05, 18:05, 23:05 Amsterdam.
   * 
   * DO NOT convert to UTC unless the server TZ env var changes!
   * If deploying to DigitalOcean with TZ=UTC, change these to: '5 6', '5 16', '5 21' instead.
   */
  scheduledTasks['5 8 * * *'] = ['inbox:gmail-sync'] // 08:05 Amsterdam CEST
  scheduledTasks['5 18 * * *'] = ['inbox:gmail-sync'] // 18:05 Amsterdam CEST
  scheduledTasks['5 23 * * *'] = ['inbox:gmail-sync'] // 23:05 Amsterdam CEST
}
if (!disableIntegrationsSchedule) {
  /**
   * Bork + Eitje: Nitro `6,13,16,18,20,22 * * *` **in Amsterdam CEST timezone** (local server clock).
   * 
   * **CRITICAL:** Cron expressions use the **server's local system timezone**, NOT UTC!
   * On this system (CEST/Amsterdam): these times run at exactly 06:00, 13:00, 16:00, 18:00, 20:00, 22:00 Amsterdam.
   * 
   * If deploying to DigitalOcean with TZ=UTC, change to: '0 6,13,16,18,20,22' instead.
   */
  scheduledTasks['0 6,13,16,18,20,22 * * *'] = ['integrations:bork-eitje-daily']
}

export default defineNuxtConfig({
  ssr: false,
  /** Sales-V2 API (`/api/sales-aggregated-v2`) — version suffix (default `_v2`). */
  runtimeConfig: {
    borkAggVersionSuffix: process.env.BORK_AGG_VERSION_SUFFIX ?? process.env.BORK_AGG_V2_SUFFIX ?? '_v2',
    borkAggV2Suffix: process.env.BORK_AGG_V2_SUFFIX ?? '',
    /** Default BTW % for “ex BTW” display on day-breakdown (Bork lines are incl. BTW). Override per session in UI. */
    public: {
      borkDisplayExVatPercent: process.env.BORK_DISPLAY_EX_VAT_PERCENT ?? '21',
    },
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
   * Inbox Gmail poll: 3× daily (`5 8`, `5 18`, `5 23` CEST = 08:05 / 18:05 / 23:05 Amsterdam on a CEST host).
   * GitHub inbox-daily-sync.yml is manual-only to avoid duplicate fetches + Actions minutes.
   *
   * Bork + Eitje: Nitro `0 6,13,16,18,20,22 * * *` CEST (06:00 / 13:00 / 16:00 / 18:00 / 20:00 / 22:00 Amsterdam).
   * Startup catch-up: `INTEGRATION_SYNC_CATCHUP_ON_START` (production default on unless set to 0) + `INTEGRATION_SYNC_STALE_MS`.
   * 
   * **CRITICAL:** Cron expressions use the server's LOCAL system timezone (CEST on this machine).
   * On DigitalOcean (TZ=UTC), change cron times to UTC: inbox `5 6,16,21`, bork `0 6,13,16,18,20,22` UTC.
   */
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks,
  },
})
