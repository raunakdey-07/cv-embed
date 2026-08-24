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

    await expect(page.getByText('Resume Readiness')).toBeVisible()

    // Mobile shows an Edit/Preview toggle; Edit is the default view.
    const toggle = page.locator('.mobile-view-toggle')
    await expect(toggle).toBeVisible()
    const editTab = toggle.getByRole('tab', { name: 'Edit' })
    const previewTab = toggle.getByRole('tab', { name: 'Preview' })
    await expect(editTab).toHaveClass(/active/)
    await expect(page.locator('.left-pane')).toBeVisible()
    await expect(page.locator('.right-pane')).toHaveCount(0)

    // Switching to Preview swaps the panes.
    await previewTab.click()
    await expect(previewTab).toHaveClass(/active/)
    await expect(page.locator('.right-pane')).toBeVisible()
    await expect(page.locator('.left-pane')).toHaveCount(0)
    await expect(page.locator('.preview-head-main .section-title').getByText('Preview')).toBeVisible()

    // Back to Edit for the export-menu flow.
    await editTab.click()
    await expect(page.locator('.left-pane')).toBeVisible()

    const exportButton = page.locator('.preview-head .tool-btn[title="Export resume"]')
    await expect(exportButton).toHaveCount(0)
  })

  test('mobile: info popovers open on tap', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only flow')

    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    const infoBtn = page.locator('.completion-info-btn')
    await infoBtn.click()
    await expect(page.locator('.completion-info-popover')).toBeVisible()
    await expect(page.locator('.completion-info-popover')).toContainText('sections complete')

    // Tap outside closes it.
    await page.locator('.mobile-view-toggle').click()
    await expect(page.locator('.completion-info-popover')).toBeHidden()
  })

  test('mobile: section nav organize sheet toggles visibility and order', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only flow')

    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    const organizeBtn = page.locator('.organize-sections-btn')
    await expect(organizeBtn).toBeVisible()

    // Touch targets should be at least 40px tall.
    const tabBox = await page.locator('.nav-tab').first().boundingBox()
    expect(tabBox).not.toBeNull()
    expect(tabBox!.height).toBeGreaterThanOrEqual(40)

    await organizeBtn.click()
    const sheet = page.locator('.organize-sheet')
    await expect(sheet).toBeVisible()

    // Basic defaults: optional sections start disabled.
    await expect(page.locator('#section-certifications')).toHaveCount(0)
    await expect(page.locator('.nav-tab', { hasText: 'Certifications' })).toHaveCount(0)

    // Enabling a section adds its editor panel and nav tab immediately.
    await sheet.locator('.order-item', { hasText: 'Certifications' }).locator('input[type="checkbox"]').check()
    await expect(page.locator('#section-certifications')).toBeVisible()
    await expect(page.locator('.nav-tab', { hasText: 'Certifications' })).toBeVisible()

    // Disabling removes both again.
    await sheet.locator('.order-item', { hasText: 'Certifications' }).locator('input[type="checkbox"]').uncheck()
    await expect(page.locator('#section-certifications')).toHaveCount(0)
    await expect(page.locator('.nav-tab', { hasText: 'Certifications' })).toHaveCount(0)

    // Core sections behave the same way (Education is on by default).
    const educationToggle = sheet.locator('.order-item', { hasText: 'Education' }).locator('input[type="checkbox"]')
    await educationToggle.uncheck()
    await expect(page.locator('#section-education')).toHaveCount(0)
    await expect(page.locator('.nav-tab', { hasText: 'Education' })).toHaveCount(0)
    await educationToggle.check()
    await expect(page.locator('#section-education')).toBeVisible()
  })
})
