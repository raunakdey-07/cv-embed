import { expect, test } from '@playwright/test'

const LONG_RESUME = {
  meta: {
    version: '1.0',
    template: 'minimal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    documentOptions: {},
  },
  basics: {
    name: 'X'.repeat(700),
    headline: 'Engineer',
    email: 'long@example.com',
    phone: '1',
    location: 'Y'.repeat(600),
    summary: 'Z'.repeat(1500),
    links: [{ label: 'Portfolio', url: 'https://example.com/' + 'q'.repeat(1200) }],
  },
  education: [{ institution: 'University', degree: 'BS', field: 'CS', cgpa: '', startDate: '', endDate: '', location: '' }],
  experience: [],
  projects: [],
  skills: { languages: ['TypeScript', 'React', 'Node'], frameworks: [], tools: [], other: [] },
  certifications: [],
  accomplishments: [],
  activities: [],
  volunteering: [],
  publications: [],
}

test('keyboard focus has a visible indicator and the skip link works', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  await page.goto('/builder')
  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()

  const focusStyles = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>('.header-import-btn')
    element?.focus()
    if (!element) return null
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focusStyles?.outlineStyle).not.toBe('none')
  expect(focusStyles?.outlineWidth).not.toBe('0px')
})

test('mobile import control opens a file chooser from either view', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only flow')
  await page.goto('/builder')
  await page.getByRole('button', { name: 'Preview' }).click()
  const chooserPromise = page.waitForEvent('filechooser')
  await page.locator('.tool-btn[title="Import resume JSON"]').click()
  const chooser = await chooserPromise
  expect(chooser.isMultiple()).toBe(false)
})

test('long unbroken resume content reflows at a narrow viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only flow')
  await page.setViewportSize({ width: 320, height: 800 })
  await page.addInitScript((resume) => {
    sessionStorage.setItem('cvembed:draft', JSON.stringify(resume))
  }, LONG_RESUME)
  await page.goto('/builder')
  await page.getByRole('button', { name: 'Preview' }).click()

  const widths = await page.evaluate(() => {
    const template = document.querySelector('.resume-template')
    const canvas = document.querySelector('.resume-preview-canvas')
    return {
      templateClient: template?.clientWidth ?? 0,
      templateScroll: template?.scrollWidth ?? 0,
      canvasClient: canvas?.clientWidth ?? 0,
      canvasScroll: canvas?.scrollWidth ?? 0,
    }
  })
  expect(widths.templateScroll).toBeLessThanOrEqual(widths.templateClient + 1)
  expect(widths.canvasScroll).toBeLessThanOrEqual(widths.canvasClient + 1)
})

test('unsafe resume links are not rendered as active links', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  await page.addInitScript((resume) => {
    sessionStorage.setItem('cvembed:draft', JSON.stringify(resume))
  }, {
    ...LONG_RESUME,
    basics: { ...LONG_RESUME.basics, links: [{ label: 'Portfolio', url: 'javascript:alert(1)' }] },
  })
  await page.goto('/builder')
  await expect(page.locator('.resume-template a[href^="javascript:"]')).toHaveCount(0)
})

test('reduced motion uses non-animated section scrolling', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const behaviors: string[] = []
    ;(window as unknown as { __cvScrollBehaviors: string[] }).__cvScrollBehaviors = behaviors
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (options?: ScrollIntoViewOptions) {
      behaviors.push(options?.behavior ?? 'auto')
      return original.call(this, options)
    }
  })

  await page.goto('/builder')
  await page.locator('.nav-tab', { hasText: 'Summary' }).click()
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __cvScrollBehaviors?: string[] }).__cvScrollBehaviors ?? [])).toContain('auto')
})

test('unknown routes explain how to recover', async ({ page }) => {
  await page.goto('/not-a-real-route')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open CV Builder' })).toBeVisible()
})
