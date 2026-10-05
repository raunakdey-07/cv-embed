import { test, expect } from '@playwright/test'

test('summary nav tab scrolls to the section and moves focus into it', async ({ page }) => {
  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  const summaryTab = page.locator('.nav-tab', { hasText: 'Summary' })
  await expect(summaryTab).toBeVisible()

  // Activating Summary highlights and scrolls to its own editor panel, and
  // leaves focus inside that panel rather than back on the tab strip.
  await summaryTab.click()
  await expect(summaryTab).toHaveClass(/active/)
  await expect(page.locator('#section-summary')).toBeInViewport()
  await expect(page.locator('#section-summary textarea').first()).toBeFocused()
})
