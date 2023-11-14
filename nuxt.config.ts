// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@formkit/nuxt'],
  formkit: {
    autoImport: true
  },
  build: {
    // You can extend webpack config here
    transpile: ['lazy-load-list'],
    analyze: {},
  },
  plugins: [],
})
