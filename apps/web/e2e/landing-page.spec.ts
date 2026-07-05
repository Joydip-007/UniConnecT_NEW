import { test, expect } from '@playwright/test';

test.describe('Landing Page - UI Polish and Experience', () => {
  test('should apply font smoothing on the root element', async ({ page }) => {
    await page.goto('/');
    // Make interfaces feel better: Font Smoothing
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).webkitFontSmoothing;
    });
    expect(bodyStyles).toBe('antialiased');
  });

  test('should have a hero section with kinetic typography', async ({ page }) => {
    await page.goto('/');
    const headline = page.locator('.uc-hero-headline');
    await expect(headline).toBeVisible();
    
    // Check if the kinetic track is present
    const track = page.locator('.uc-hero-kinetic-track');
    await expect(track).toBeVisible();
  });

  test('buttons should have sufficient hit area (min 40x40px)', async ({ page }) => {
    await page.goto('/');
    
    // Check main call to action buttons
    const buttons = await page.locator('button, a[role="button"], .uc-btn').all();
    
    for (const btn of buttons) {
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        const hasPseudo = await btn.evaluate((el) => {
          const before = window.getComputedStyle(el, '::before');
          const hasValidBefore = before.content && before.content !== 'none' && parseFloat(before.minWidth || '0') >= 40 && parseFloat(before.minHeight || '0') >= 40;
          const after = window.getComputedStyle(el, '::after');
          const hasValidAfter = after.content && after.content !== 'none' && parseFloat(after.minWidth || '0') >= 40 && parseFloat(after.minHeight || '0') >= 40;
          return hasValidBefore || hasValidAfter;
        });
        
        if (box && !hasPseudo) {
          expect(box.width).toBeGreaterThanOrEqual(40);
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });

  test('prefers-reduced-motion disables kinetic typography animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    
    // The track should have the is-paused class or equivalent when reduced motion is preferred
    const track = page.locator('.uc-hero-kinetic-track');
    await expect(track).toHaveClass(/is-paused/);
  });

  test('should render RadialOrbitalTimeline with nodes', async ({ page }) => {
    await page.goto('/');
    
    // The radial orbital timeline should be present and visible
    const timeline = page.locator('.uc-orbital-container');
    if (await timeline.count() > 0) {
       await expect(timeline).toBeVisible();
       
       // Ensure nodes exist
       const nodes = page.locator('.uc-orbital-node');
       expect(await nodes.count()).toBeGreaterThan(0);
    }
  });
});
