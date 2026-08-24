import { test, expect } from '@playwright/test'

const SEED = {
  meta: {
    version: '1.0',
    template: 'minimal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documentOptions: {},
  },
  basics: { name: 'T', headline: '', email: 't@e.com', phone: '1', location: '', summary: '', links: [{ label: '', url: '' }] },
  education: [{ institution: 'E', degree: 'D', field: 'F', cgpa: '', startDate: '', endDate: '', location: '' }],
  experience: [{ company: 'C', role: 'R', location: '', startDate: '', endDate: '', bullets: [''] }],
  projects: [],
  skills: { languages: ['a', 'b', 'c'], frameworks: [], tools: [], other: [] },
  certifications: [], accomplishments: [], activities: [], volunteering: [], publications: [],
}

async function seed(page: import('@playwright/test').Page) {
  await page.addInitScript((r) => sessionStorage.setItem('cvembed:draft', JSON.stringify(r)), SEED)
}

test('order + visibility drive form, nav, and preview together', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow (preview pane is toggle-based on mobile)')

  await seed(page)
  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  // Form order initially: Education before Experience.
  const ids = await page.locator('.left-pane > div[id^="section-"]').evaluateAll(
    (els) => els.map((e) => e.id),
  )
  expect(ids.indexOf('section-education')).toBeLessThan(ids.indexOf('section-experience'))

  // Preview order matches too.
  const previewHeadings = await page.locator('.resume-template h2').allTextContents()
  expect(previewHeadings.indexOf('Education')).toBeLessThan(previewHeadings.indexOf('Experience'))

  // Move Experience up in the organize sheet.
  await page.locator('.organize-sections-btn').click()
  const sheet = page.locator('.organize-sheet')
  await sheet.locator('.order-item', { hasText: 'Experience' }).locator('[title="Move up"]').click()

  // Form reordered.
  const ids2 = await page.locator('.left-pane > div[id^="section-"]').evaluateAll(
    (els) => els.map((e) => e.id),
  )
  expect(ids2.indexOf('section-experience')).toBeLessThan(ids2.indexOf('section-education'))

  // Preview reordered.
  const headings2 = await page.locator('.resume-template h2').allTextContents()
  expect(headings2.indexOf('Experience')).toBeLessThan(headings2.indexOf('Education'))

  // Visibility: hiding Education removes it everywhere.
  await sheet.locator('.order-item', { hasText: 'Education' }).locator('input[type="checkbox"]').uncheck()
  await expect(page.locator('#section-education')).toHaveCount(0)
  await expect(page.locator('.resume-template h2', { hasText: 'Education' })).toHaveCount(0)

  // Re-enable for cleanliness.
  await sheet.locator('.order-item', { hasText: 'Education' }).locator('input[type="checkbox"]').check()
  await expect(page.locator('#section-education')).toBeVisible()
})
