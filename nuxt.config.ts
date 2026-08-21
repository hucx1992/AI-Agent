// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    /** OpenAI / 兼容接口的密钥，仅服务端可读 */
    openaiApiKey: '',
    /** 兼容第三方 OpenAI 协议端点，如 DeepSeek、通义等 */
    openaiBaseUrl: '',
    openaiModel: 'qwen-plus',
    public: {},
  },
})
