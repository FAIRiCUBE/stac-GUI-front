// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@formkit/nuxt'],
  formkit: {
    autoImport: true
  },
  runtimeConfig: {
    // The private keys which are only available within server-side
    apiSecret: "123",
    // Keys within public, will be also exposed to the client-side
    public: {
      apiBase: process.env.NUXT_API_BASE_URL || "",
      owner: process.env.NUXT_OWNER,
      repo: process.env.NUXT_REPO,
      authentication: process.env.NUXT_AUTH || "",
    }
  },
  build: {
    // You can extend webpack config here
    transpile: ['lazy-load-list'],
    analyze: {},
  },
  plugins: [],
})
