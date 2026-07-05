import { test, expect } from '@playwright/test';
test('take mobile screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'hero-screenshot-mobile.png' });
});
