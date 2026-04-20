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
   * Nitro scheduled tasks: inbox Gmail polling runs on GitHub Actions (inbox-daily-sync.yml), same UTC hours as Bork/Eitje +10m — avoids duplicate server-side cron on DO.
   * Task `inbox:gmail-sync` remains available for manual `npx nuxt task run inbox:gmail-sync` if needed.
   */
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {},
  },
})
