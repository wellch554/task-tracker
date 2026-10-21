import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Each run gets its own tasks file so e2e tests never touch dev data.
const tasksFile = join(tmpdir(), `task-tracker-e2e-${Date.now()}.json`);

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev --prefix api',
      url: 'http://localhost:3001/api/tasks',
      env: { PORT: '3001', TASKS_FILE: tasksFile },
      // Never reuse a running dev API: it would be backed by real data.
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev --prefix web -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
