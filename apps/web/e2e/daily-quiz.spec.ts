import { test, expect } from '@playwright/test'

test.describe('Daily quiz', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/learn')
  })

  test('quiz card is visible with take quiz CTA', async ({ page }) => {
    await expect(page.getByText('Daily quiz — Computer Science')).toBeVisible({ timeout: 6000 })
    await expect(page.getByRole('button', { name: 'Take quiz' })).toBeVisible()
  })

  test('opening modal shows first question and progress', async ({ page }) => {
    await page.getByRole('button', { name: 'Take quiz' }).click()
    await expect(page.getByText('What does CPU stand for?')).toBeVisible({ timeout: 4000 })
    await expect(page.getByText('1 / 3')).toBeVisible()
  })

  test('selecting all options reveals submit button', async ({ page }) => {
    await page.getByRole('button', { name: 'Take quiz' }).click()
    await page.getByText('Central Processing Unit').click()
    await expect(page.getByText('Which language is used')).toBeVisible({ timeout: 2000 })
    await page.getByText('CSS').click()
    await expect(page.getByText('What is a compiler?')).toBeVisible({ timeout: 2000 })
    await page.getByText('A program that translates source code').click()
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible()
  })

  test('submitting shows score on result screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Take quiz' }).click()
    await page.getByText('Central Processing Unit').click()
    await expect(page.getByText('Which language is used')).toBeVisible({ timeout: 2000 })
    await page.getByText('CSS').click()
    await expect(page.getByText('What is a compiler?')).toBeVisible({ timeout: 2000 })
    await page.getByText('A program that translates source code').click()
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('100%')).toBeVisible({ timeout: 4000 })
    await expect(page.getByText(/you passed/)).toBeVisible()
  })
})
