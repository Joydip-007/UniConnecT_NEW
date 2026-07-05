import { expect, test } from '@playwright/test'

test.describe('Sidebar icon rail', () => {
  test('collapses and expands on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/feed?dev-auth=1')

    const grid = page.locator('.feed-layout-grid')
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
    await expect(grid).toHaveAttribute('data-left-sidebar', 'expanded')

    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await expect(grid).toHaveAttribute('data-left-sidebar', 'collapsed')
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible()

    const leftBox = await page.locator('.feed-layout-left').boundingBox()
    expect(leftBox?.width).toBeGreaterThanOrEqual(68)
    expect(leftBox?.width).toBeLessThanOrEqual(72)

    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect(grid).toHaveAttribute('data-left-sidebar', 'expanded')
  })

  test('keeps the 68px rail at 768px while right sidebar is hidden', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await page.goto('/feed?dev-auth=1')
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()

    await expect(page.locator('.feed-layout-right')).toBeHidden()
    const leftBox = await page.locator('.feed-layout-left').boundingBox()
    expect(leftBox?.width).toBeGreaterThanOrEqual(68)
    expect(leftBox?.width).toBeLessThanOrEqual(72)
  })

  test('keeps mobile bottom nav as primary navigation below 768px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/feed?dev-auth=1')

    await expect(page.locator('.feed-layout-left')).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toHaveCount(0)
  })
})
