import { test, expect } from '@playwright/test'

test('format sheet: template switch and header alignment flow to preview', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow (preview pane is toggle-based on mobile)')

  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  // Open the format dropdown via the paintbrush button.
  await page.locator('.format-btn').click()
  const sheet = page.locator('.format-sheet')
  await expect(sheet).toBeVisible()

  // Template control exists and switches the rendered layout.
  const templateSelect = sheet.locator('select').first()
  await expect(templateSelect).toBeVisible()
  await expect(page.locator('.resume-template.template-compact')).toHaveCount(0)
  await templateSelect.selectOption('compact')
  await expect(page.locator('.resume-template.template-compact')).toBeVisible()
  await templateSelect.selectOption('minimal')
  await expect(page.locator('.resume-template.template-compact')).toHaveCount(0)

  // Header alignment: left alignment applies the header-left class.
  const alignSelect = sheet.locator('label', { hasText: 'Header Alignment' }).locator('select')
  await alignSelect.selectOption('left')
  await expect(page.locator('.resume-template.header-left')).toBeVisible()

  // Chevron affordance present on both nav buttons.
  await expect(page.locator('.format-btn svg')).toHaveCount(2)
  await expect(page.locator('.organize-sections-btn svg')).toHaveCount(2)
})
