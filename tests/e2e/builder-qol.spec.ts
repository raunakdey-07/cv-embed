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

  test('mobile: view switch and export menu are usable', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only flow')

    await page.goto('/builder')

    const previewTab = page.getByRole('tab', { name: 'Preview' })
    await previewTab.click()
    await expect(page.locator('.preview-head-main .section-title').getByText('Preview')).toBeVisible()

    const editButton = page.getByRole('button', { name: /Edit/i }).first()
    await editButton.click()
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    const exportButton = page.locator('.mobile-bottom-actions').getByRole('button', { name: /Export/i })
    await exportButton.click({ force: true })
    await expect(page.getByRole('menu', { name: 'Mobile export menu' })).toBeVisible()
  })
})
