import { expect, test } from '@playwright/test'

test.describe('Study groups 2.0', () => {
  test('shows the study workspace and switches between sessions, decks, and notes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/groups/dev-study-group?dev-auth=1')

    await page.getByRole('tab', { name: 'Study sessions' }).click()
    await expect(page.getByRole('tablist', { name: 'Study tools' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Sessions' })).toHaveAttribute('aria-selected', 'true')

    await page.getByRole('tab', { name: 'Decks' }).click()
    await expect(page.getByText('Algorithms midterm')).toBeVisible()
    await expect(page.getByText('1 due')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Review' })).toBeVisible()

    await page.getByRole('button', { name: /Show answer/i }).click()
    await expect(page.getByText(/negative edges can invalidate/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Good' })).toBeVisible()

    await page.getByRole('tab', { name: 'Notes' }).click()
    await expect(page.getByText('Greedy proof checklist')).toBeVisible()
    await expect(page.getByText(/State the greedy choice/i)).toBeVisible()
  })
})
