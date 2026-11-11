import { defineConfig } from '@playwright/test'

const baseURL = process.env.APP_BUILDER_URL
if (!baseURL) throw new Error('请设置 APP_BUILDER_URL，指向已配置模型的工作台地址。')

export default defineConfig({
  testDir: './tests',
  testMatch: '**/generation.live.spec.ts',
  timeout: 150_000,
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL },
})
