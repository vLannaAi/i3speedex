export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  future: { compatibilityVersion: 4 },
  ssr: false,

  modules: ['@unocss/nuxt', '@nuxtjs/google-fonts'],

  googleFonts: {
    families: {
      'Google Sans Flex': [300, 400, 500, 600, 700],
    },
    display: 'swap',
    preload: true,
    download: true,
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiBaseUrl: '',
      cognitoUserPoolId: '',
      cognitoClientId: '',
      cognitoRegion: '',
    },
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'i3speedex — Gestione Vendite',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Gestione vendite, acquirenti e produttori' },
      ],
      htmlAttrs: { lang: 'it' },
      script: [
        { src: 'https://kit.fontawesome.com/9ab53866ec.js', crossorigin: 'anonymous' },
      ],
    },
  },

  devtools: { enabled: true },
})
