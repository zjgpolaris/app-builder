import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4178'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/*.live.spec.ts',
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4178 --strictPort',
    url: baseURL,
  },
})
