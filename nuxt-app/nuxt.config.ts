export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  srcDir: '.',
  css: ['~/app/assets/css/main.css'],
  devServer: {
    port: 8080,
  },
  compatibilityDate: '2026-02-21',
  ui: {
    colorMode: false,
  },
})
