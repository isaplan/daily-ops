/** Set `DISABLE_INBOX_SCHEDULED=1` locally to skip Gmail poll when Mongo is offline. */
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
   * Inbox Gmail poll: one run per day on the DO Node process (no extra DO Job component).
   * `0 8 * * *` UTC ≈ 10:00 Europe/Amsterdam in CEST (UTC+2). In CET (winter) same cron is ~09:00 local — adjust if needed.
   * GitHub inbox-daily-sync.yml is manual-only to avoid duplicate fetches + Actions minutes.
   */
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: disableInboxSchedule
      ? {}
      : {
          '0 8 * * *': ['inbox:gmail-sync'],
        },
  },
})
