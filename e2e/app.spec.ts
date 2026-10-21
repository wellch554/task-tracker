import { expect, test } from '@playwright/test';

test('loads the app', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Task Tracker');
});
