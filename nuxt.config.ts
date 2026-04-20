const disableInboxSchedule = process.env.DISABLE_INBOX_SCHEDULED === '1'

export default defineNuxtConfig({
  ssr: false,
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
   * Nitro scheduled tasks: cron runs inside the Node server (DO App `npm start`).
   * Starter: `0 7 * * *` = 07:00 UTC daily. Adjust here or use crontab.guru.
   * Local dev: set DISABLE_INBOX_SCHEDULED=1 in .env.local to skip (avoids Mongo SRV errors when offline).
   */
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: disableInboxSchedule
      ? {}
      : {
          '0 7 * * *': ['inbox:gmail-sync'],
        },
  },
})
