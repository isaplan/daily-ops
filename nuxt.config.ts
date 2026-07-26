/**
 * Nitro crons (Gmail + Bork/Eitje) run on DO production only.
 * Local `pnpm dev` often uses prod Mongo — duplicating crons causes overlap/timeouts.
 * Set `ENABLE_NITRO_SCHEDULED_TASKS=1` to test crons locally; `DISABLE_*` still fine-tunes production.
 *
 * PWA: @vite-pwa/nuxt module included (2026-06-03)
 */
import { buildBorkEitjeDailyNitroCronEntries } from './utils/integrations/borkEitjeDailyCronSchedule'
const enableNitroScheduled =
  process.env.NODE_ENV === 'production' || process.env.ENABLE_NITRO_SCHEDULED_TASKS === '1'
/** Set `DISABLE_INBOX_SCHEDULED=1` to skip Gmail poll (e.g. prod without inbox). */
const disableInboxSchedule = process.env.DISABLE_INBOX_SCHEDULED === '1'
/** Set `DISABLE_INTEGRATIONS_SCHEDULED=1` to skip Bork/Eitje Nitro cron on production. */
const disableIntegrationsSchedule = process.env.DISABLE_INTEGRATIONS_SCHEDULED === '1'
/** Set `DISABLE_OPS_NOTIFICATION_AUTO_RETRY=1` to skip self-heal cron on production. */
const disableOpsAutoRetry = process.env.DISABLE_OPS_NOTIFICATION_AUTO_RETRY === '1'

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
  // Nitro scheduled tasks disabled (not production). DO runs crons; set ENABLE_NITRO_SCHEDULED_TASKS=1 to test locally.
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
   * Bork + Eitje **morning maintenance** (06:00): master + 7d historical (through yesterday).
   * **Monthly** (1st 06:30): 31d historical. Daily `daily-data`: per-weekday Amsterdam hours — SSOT:
   * `utils/integrations/borkEitjeDailyCronSchedule.ts`
   */
  scheduledTasks['0 6 * * *'] = ['integrations:bork-eitje-morning-maintenance']
  scheduledTasks['30 6 1 * *'] = ['integrations:bork-eitje-historical-monthly']
  Object.assign(scheduledTasks, buildBorkEitjeDailyNitroCronEntries())
  /** Weekly digest read-cache — Monday 01:00 Amsterdam (last completed ISO week). */
  scheduledTasks['0 1 * * 1'] = ['daily-ops:weekly-digest-cache']
  /** Weekly report sealed documents — Monday 01:15 Amsterdam. */
  scheduledTasks['15 1 * * 1'] = ['daily-ops:weekly-report-build']
  /** Monthly report sealed documents — 1st of month 01:15 Amsterdam. */
  scheduledTasks['15 1 1 * *'] = ['daily-ops:monthly-report-build']
  /** The Hague weather sync — daily 06:15 Amsterdam. */
  scheduledTasks['15 6 * * *'] = ['daily-ops:weather-sync']
}
if (enableNitroScheduled && !disableOpsAutoRetry) {
  // Self-heal ops alerts (:17/:47) — staggered away from :00/:05 integration/inbox windows.
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
      /**
       * Revenue navigation version. Set REVENUE_NAV_VERSION=v2 to opt into the new
       * two-tier tab nav (ADR-011). Default v1 keeps the existing dropdown filter.
       */
      revenueNavVersion: (process.env.REVENUE_NAV_VERSION ?? 'v1') as 'v1' | 'v2',
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
      // Avoid ENOENT on `.nuxt/dev-sw-dist/sw.js` when .nuxt is stale; opt-in with PWA_DEV=1
      enabled: process.env.PWA_DEV === '1',
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
  /** DevTools: disabled by default (saves ~83s cold start). Set DEVTOOLS=1 to enable. */
  devtools: {
    enabled: process.env.DEVTOOLS === '1',
  },
  ui: {
    colorMode: false,
  },
  vite: {
    optimizeDeps: {
      /**
       * Pre-bundle all heavy client deps during Vite startup.
       * Prevents on-demand discovery per-import (was causing 139s plugins.client.mjs compile).
       */
      include: [
        'd3',
        '@tiptap/vue-3',
        '@tiptap/starter-kit',
        '@tiptap/extension-placeholder',
        'pdfjs-dist',
        'xlsx',
        'date-holidays',
        'papaparse',
      ],
    },
    build: {
      rollupOptions: {
        output: {
          /**
           * Split heavy deps into dedicated chunks so the main bundle stays lean.
           * Improves both cold production build speed and browser caching.
           */
          manualChunks: (id: string) => {
            if (id.includes('node_modules/d3') || id.includes('node_modules/d3-')) return 'vendor-d3'
            if (id.includes('node_modules/@tiptap')) return 'vendor-tiptap'
            if (id.includes('node_modules/pdfjs-dist')) return 'vendor-pdfjs'
            if (id.includes('node_modules/xlsx')) return 'vendor-xlsx'
            if (id.includes('node_modules/date-holidays')) return 'vendor-date-holidays'
            if (id.includes('node_modules/papaparse')) return 'vendor-papaparse'
          },
        },
      },
    },
    /** Warm common entry files so `client.manifest.mjs` exists before first browser hit (reduces dev race). */
    server: {
      warmup: {
        clientFiles: [
          './app.vue',
          './pages/daily-ops/inbox/index.vue',
          './pages/daily-ops/revenue.vue',
          './pages/daily-ops/index.vue',
        ],
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
