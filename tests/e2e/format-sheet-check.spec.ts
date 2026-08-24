import { test, expect } from '@playwright/test'

test('format sheet opens from nav Format tab', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow (preview pane is toggle-based on mobile)')

  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  // No format panel in the form anymore.
  await expect(page.locator('#section-document-options')).toHaveCount(0)

  const formatTab = page.locator('.nav-tab', { hasText: 'Format' })
  await expect(formatTab).toBeVisible()
  await formatTab.click()

  const sheet = page.locator('.nav-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Accent Color')).toBeVisible()
  await expect(sheet.getByText('Dates')).toBeVisible()

  // Changing accent color inside the sheet updates the preview.
  await sheet.locator('input[type="color"]').fill('#ff0000')
  await expect(page.locator('.resume-template')).toHaveCSS('--primary', '#ff0000')

  // Escape closes it.
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
})
