import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 5 * 60 * 1000, // 5 min per test (AI operations can be slow)
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    // Video recording for demo
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Slow down for visual clarity in demo video
    launchOptions: {
      slowMo: 200,
    },
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'demo-recording',
      testMatch: /demo-recording\.spec\.ts/,
    },
    {
      name: 'performance',
      testMatch: /performance\.spec\.ts/,
      use: {
        // 性能测试不需要慢放
        launchOptions: {
          slowMo: 0,
        },
        // 性能测试不需要视频
        video: {
          mode: 'off',
        },
      },
    },
  ],
})
