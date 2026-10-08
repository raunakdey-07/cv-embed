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
    await expect(page.locator('.completion-pill-wrap').filter({ has: fixNext }).locator('.completion-pill-popover')).toContainText('Next')

    await fixNext.click()
    await expect(page.locator('.section-shell.is-active').first()).toBeVisible()

    // The header still shows its status states, but no page count: a fresh CV
    // has never been measured, and an unmeasured count has no UI at all.
    await expect(page.locator('.save-indicator')).toBeVisible()
    await expect(page.locator('.score-pill')).toBeVisible()
    await expect(page.locator('.page-indicator')).toHaveCount(0)
  })

  test('mobile: stacked layout and export menu are usable', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only flow')

    await page.goto('/builder')

    await expect(page.getByText('Resume Readiness')).toBeVisible()

    // Mobile shows an Edit/Preview toggle; Edit is the default view.
    const toggle = page.locator('.mobile-view-toggle')
    await expect(toggle).toBeVisible()
    const editTab = toggle.getByRole('button', { name: 'Edit' })
    const previewTab = toggle.getByRole('button', { name: 'Preview' })
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

    await page.addInitScript(() => {
      sessionStorage.setItem('cvembed:draft', JSON.stringify({
        meta: { version: '1.0', template: 'minimal', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', documentOptions: {} },
        basics: { name: 'Touch User', headline: 'Engineer', email: 't@example.com', phone: '1', location: 'Remote', summary: 'Builds reliable tools.', links: [] },
        education: [{ institution: 'U', degree: 'BS', field: 'CS', cgpa: '', startDate: '', endDate: '', location: '' }],
        experience: [], projects: [],
        skills: { languages: ['TypeScript', 'React'], frameworks: [], tools: [], other: [] },
        certifications: [], accomplishments: [], activities: [], volunteering: [], publications: [],
      }))
    })
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

    // Width too. A later narrow-viewport rule was cancelling the width the
    // coarse-pointer block granted, so the icon buttons measured 16-22px wide
    // on a phone while the height-only check above still passed. Every control
    // here sits 3-5px from its neighbour, so the spacing exception for small
    // targets does not apply to any of them.
    const widths = await page.evaluate(() => {
      const measure = (selector: string) => {
        const element = document.querySelector(selector)
        if (!element) return { selector, missing: true }
        const rect = element.getBoundingClientRect()
        return { selector, width: Math.round(rect.width), height: Math.round(rect.height) }
      }
      return ['.completion-info-btn', '.order-btn', '.chip button'].map(measure)
    })
    for (const target of widths) {
      expect(target.missing, `${target.selector} exists`).toBeFalsy()
      expect(target.width ?? 0, `${target.selector} width`).toBeGreaterThanOrEqual(24)
    }

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
