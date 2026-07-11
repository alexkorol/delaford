import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL
  || (process.platform === 'win32' && existsSync(localChrome) ? 'chrome' : null);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    // Browser resilience specs boot the real game server on :6512, which also
    // serves dist/. Keeping HTTP and WS same-origin mirrors production and
    // avoids a second long-lived Vite process on Windows.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:6512',
    ...(browserChannel ? { channel: browserChannel } : {}),
    headless: true,
  },
});
