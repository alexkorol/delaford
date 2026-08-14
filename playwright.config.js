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
    // The critical-loop spec navigates relative to baseURL and expects the
    // externally booted game server on :6500 (see npm run test:e2e:built).
    // The reconnect/smoke specs boot their own servers on :6512/:6514 and
    // navigate by absolute URL, so this default does not affect them.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:6500',
    ...(browserChannel ? { channel: browserChannel } : {}),
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
