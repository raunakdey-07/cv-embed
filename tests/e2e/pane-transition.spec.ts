import { test, expect } from '@playwright/test'

test('mobile pane switch animates (fade + rise)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only flow')

  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  const previewTab = page.locator('.mobile-view-toggle').getByRole('tab', { name: 'Preview' })
  await previewTab.click()

  const pane = page.locator('.right-pane')
  await expect(pane).toBeVisible()

  // The pane carries the animation class and a running animation.
  await expect(pane).toHaveClass(/mobile-pane-enter/)
  const animName = await pane.evaluate((el) => getComputedStyle(el).animationName)
  expect(animName).toBe('pane-enter')

  // Animation ends at full opacity.
  await expect(pane).toHaveCSS('opacity', '1', { timeout: 2000 })
})
