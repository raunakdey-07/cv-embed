import { test, expect } from '@playwright/test'

test.describe('Builder QoL flows', () => {
  test('desktop: readiness fix-next stays actionable and shows preview header states', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')

    await page.goto('/builder')

    await expect(page.getByText('Resume Readiness')).toBeVisible()
    await expect(page.locator('.preview-head-main .section-title').getByText('Preview')).toBeVisible()

    const fixNext = page.getByRole('button', { name: /Fix next/i })
    await expect(fixNext).toBeVisible()

    await fixNext.hover()
    await expect(page.locator('.completion-pill-wrap').filter({ has: fixNext }).getByRole('tooltip')).toContainText('Next action:')

    await fixNext.click()
    await expect(page.locator('.section-shell.is-active').first()).toBeVisible()

    await expect(page.getByText(/Pages:/i)).toBeVisible()
  })

  test('mobile: stacked layout and export menu are usable', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only flow')

    await page.goto('/builder')

    await expect(page.locator('.preview-head-main .section-title').getByText('Preview')).toBeVisible()
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    const leftPane = page.locator('.left-pane')
    const rightPane = page.locator('.right-pane')
    const [leftBox, rightBox] = await Promise.all([leftPane.boundingBox(), rightPane.boundingBox()])
    expect(leftBox).not.toBeNull()
    expect(rightBox).not.toBeNull()
    expect(leftBox!.y).toBeLessThan(rightBox!.y)

    const exportButton = page.locator('.preview-head .tool-btn[title="Export resume"]')
    await expect(exportButton).toBeVisible()
    await exportButton.click()
    await expect(page.locator('.export-dropdown')).toBeVisible()
  })
})
