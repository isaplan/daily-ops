/**
 * Nitro crons (Gmail + Bork/Eitje) run on DO production only.
 * Local `pnpm dev` often uses prod Mongo — duplicating crons causes overlap/timeouts.
 * Set `ENABLE_NITRO_SCHEDULED_TASKS=1` to test crons locally; `DISABLE_*` still fine-tunes production.
 * 
 * PWA: @vite-pwa/nuxt module included (2026-06-03)
 */
const enableNitroScheduled =
  process.env.NODE_ENV === 'production' || process.env.ENABLE_NITRO_SCHEDULED_TASKS === '1'
/** Set `DISABLE_INBOX_SCHEDULED=1` to skip Gmail poll (e.g. prod without inbox). */
const disableInboxSchedule = process.env.DISABLE_INBOX_SCHEDULED === '1'
/** Set `DISABLE_INTEGRATIONS_SCHEDULED=1` to skip Bork/Eitje Nitro cron on production. */
const disableIntegrationsSchedule = process.env.DISABLE_INTEGRATIONS_SCHEDULED === '1'
/** Optional: auto-retry selected ops notifications (disabled by default). */
const enableOpsAutoRetry = process.env.ENABLE_OPS_NOTIFICATION_AUTO_RETRY === '1'

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
if (!enableNitroScheduled) {
  console.log(
    '[NUXT CONFIG] Nitro scheduled tasks disabled (not production). DO runs crons; set ENABLE_NITRO_SCHEDULED_TASKS=1 to test locally.',
  )
}
if (enableNitroScheduled && !disableInboxSchedule) {
  /**
   * Gmail inbox poll — **4×/day** Amsterdam (`inbox:gmail-sync`). Canonical spec + purposes: `server/tasks/inbox/gmail-sync.ts` metadata header.
   * Not the Bork/Eitje API integration schedule (`integrations:bork-eitje-*`).
   * TZ=Europe/Amsterdam required on the server for correct wall-clock.
   */
  scheduledTasks['5 8 * * *'] = ['inbox:gmail-sync']
  scheduledTasks['5 12 * * *'] = ['inbox:gmail-sync']
  scheduledTasks['5 18 * * *'] = ['inbox:gmail-sync']
  scheduledTasks['5 23 * * *'] = ['inbox:gmail-sync']
}
if (enableNitroScheduled && !disableIntegrationsSchedule) {
  /**
   * Bork + Eitje **morning maintenance** (06:00): `master-data` then `historical-data` for both integrations.
   * Same sync pipeline as daily (`runIntegrationCronJob` → raw upsert + Bork V2 / Eitje labor rules for that job type).
   * Bork master/historical ticket pulls exclude **today** (yesterday-only for master; window ends yesterday for historical).
   * Eitje historical uses the same rule (`dateRangeDaysEndingYesterday`); Eitje master is list endpoints (not day-scoped).
   *
   * Bork + Eitje **daily** (`daily-data`): yesterday + today labor/tickets, 9× per day Amsterdam (no slot at 06:00 — independent of maintenance).
   * - 01:00, 08:00, 15:00, 18:00, 19:00, 20:00, 21:00, 22:00, 23:00
   * - **Plus:** 02:00 on Friday/Saturday (late-night weekend captures)
   *
   * Cron expressions use TZ from the server env (set TZ=Europe/Amsterdam on DO).
   */
  scheduledTasks['0 6 * * *'] = ['integrations:bork-eitje-morning-maintenance']
  scheduledTasks['0 1,8,15,18,19,20,21,22,23 * * *'] = ['integrations:bork-eitje-daily']
  scheduledTasks['0 2 * * 5,6'] = ['integrations:bork-eitje-daily'] // 02:00 Fri/Sat only
}
if (enableNitroScheduled && enableOpsAutoRetry) {
  // Staggered away from :00/:05 integration/inbox windows.
  scheduledTasks['17,47 * * * *'] = ['ops-notifications:auto-retry']
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
  modules: ['@nuxt/ui', '@vite-pwa/nuxt'],
  srcDir: '.',
  pwa: {
    manifest: {
      name: 'DO Teams',
      short_name: 'DO Teams',
      description: 'Daily Operations Management - Restaurant & Bar Operations Hub',
      theme_color: '#4a148c',
      background_color: '#ffffff',
      categories: ['productivity', 'business'],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
      globIgnores: ['**/node_modules/**/*', '.nuxt/**/*'],
      runtimeCaching: [
        {
          urlPattern: '^https://.*',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'https-calls',
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 5 * 60, // 5 minutes
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: '^/api/.*',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 500,
              maxAgeSeconds: 2 * 60, // 2 minutes
            },
          },
        },
      ],
    },
    devOptions: {
      enabled: true,
      suppressWarnings: true,
      navigateFallback: '/',
      type: 'module',
    },
  },
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
  hooks: {
    'nitro:config': (nitroConfig) => {
      const registrations = nitroConfig.imports?.imports
      if (!Array.isArray(registrations) || registrations.length === 0) return

      // During ongoing modularization we can temporarily have the same symbol exported
      // from a legacy barrel and the new module. Keep one registration per symbol to
      // prevent noisy "Duplicated imports ... ignored" warnings in dev.
      const deduped = new Map<string, unknown>()
      for (const entry of registrations) {
        if (!entry || typeof entry !== 'object') continue
        const name = (entry as { name?: unknown }).name
        if (typeof name !== 'string' || name.length === 0) continue
        deduped.set(name, entry)
      }

      nitroConfig.imports!.imports = [...deduped.values()] as typeof registrations
    },
  },
})
