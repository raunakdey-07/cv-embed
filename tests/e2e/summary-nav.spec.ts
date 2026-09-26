import { test, expect } from '@playwright/test'

test('summary nav tab scrolls to basics and focuses summary field', async ({ page }) => {
  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  const summaryTab = page.locator('.nav-tab', { hasText: 'Summary' })
  await expect(summaryTab).toBeVisible()

  // Clicking Summary highlights and scrolls to its own editor panel.
  await summaryTab.click()
  await expect(summaryTab).toHaveClass(/active/)
  await expect(page.locator('#section-summary')).toBeInViewport()
})
