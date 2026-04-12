export default defineNuxtConfig({
  ssr: false,
  modules: ['@nuxt/ui'],
  srcDir: '.',
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
  },
})
