import { test, expect } from '@playwright/test';
test('take screenshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'hero-screenshot.png' });
});
