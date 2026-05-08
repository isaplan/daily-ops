/** Set `DISABLE_INBOX_SCHEDULED=1` locally to skip Gmail poll when Mongo is offline. */
const disableInboxSchedule = process.env.DISABLE_INBOX_SCHEDULED === '1'
/** Set `DISABLE_INTEGRATIONS_SCHEDULED=1` locally to skip Bork/Eitje Nitro cron (same as DISABLE_INBOX pattern). */
const disableIntegrationsSchedule = process.env.DISABLE_INTEGRATIONS_SCHEDULED === '1'

/**
 * CANONICAL TIMEZONE: Europe/Amsterdam (CEST/CET)
 * 
 * This app is built around Amsterdam business hours and reporting.
 * ALL scheduled tasks run in Amsterdam time, regardless of server location.
 * 
 * **DEPLOYMENT REQUIREMENT:** Set `TZ=Europe/Amsterdam` in your server environment!
 * - Docker: `ENV TZ=Europe/Amsterdam`
 * - DigitalOcean App Platform: Set in app spec
 * - Vercel: `TZ=Europe/Amsterdam` in env vars
 * - AWS: Set in task definition or Lambda layer
 * 
 * This ensures cron expressions are interpreted consistently across all deployments.
 */
const APP_TIMEZONE = 'Europe/Amsterdam'
const CURRENT_TZ = process.env.TZ || 'local'

if (CURRENT_TZ !== APP_TIMEZONE && CURRENT_TZ !== 'local') {
  console.warn(
    `[NUXT CONFIG] WARNING: TZ="${CURRENT_TZ}" but app expects TZ="${APP_TIMEZONE}"`
  )
  console.warn(
    `[NUXT CONFIG] Cron times may be incorrect! Set TZ=Europe/Amsterdam in your deployment.`
  )
}

const scheduledTasks: Record<string, string[]> = {}
if (!disableInboxSchedule) {
  /**
   * Gmail inbox poll 3×/day in Amsterdam time:
   * - 08:05 (morning: fetch overnight Bork reports)
   * - 18:05 (evening: fetch day-end reports)
   * - 23:05 (late night: catch stragglers)
   * 
   * These times are ALWAYS 08:05, 18:05, 23:05 Amsterdam REGARDLESS of server location.
   * Croner uses TZ env var to interpret the expression.
   */
  scheduledTasks['5 8 * * *'] = ['inbox:gmail-sync']
  scheduledTasks['5 18 * * *'] = ['inbox:gmail-sync']
  scheduledTasks['5 23 * * *'] = ['inbox:gmail-sync']
}
if (!disableIntegrationsSchedule) {
  /**
   * Bork + Eitje aggregation runs 6× daily in Amsterdam time:
   * - 06:00 (early morning, before first inbox poll)
   * - 13:00 (midday, after first reports)
   * - 16:00 (afternoon)
   * - 18:00 (evening, before inbox poll)
   * - 20:00 (night)
   * - 22:00 (late night)
   * 
   * These times are ALWAYS in Amsterdam REGARDLESS of server location.
   * Croner uses TZ env var to interpret the expression.
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
   * Scheduled tasks run in Amsterdam time (TZ=Europe/Amsterdam).
   * See comments above for times.
   * 
   * Startup catch-up: `INTEGRATION_SYNC_CATCHUP_ON_START` (production default on unless set to 0) + `INTEGRATION_SYNC_STALE_MS`.
   */
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks,
  },
})
