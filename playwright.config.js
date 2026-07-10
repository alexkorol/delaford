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
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5174',
    ...(browserChannel ? { channel: browserChannel } : {}),
    headless: true,
  },
  webServer: {
    command: 'npm run dev:client -- --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_WS_URL: 'ws://127.0.0.1:6512',
    },
  },
});
