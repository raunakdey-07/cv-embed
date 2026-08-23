import { test, expect } from '@playwright/test'

// Minimal non-blank resume; seeded into sessionStorage so the page-estimate
// pipeline has real work to do (blank resumes short-circuit before touching
// the PDF engine).
const SEED_RESUME = {
  meta: {
    version: '1.0',
    template: 'minimal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documentOptions: {},
  },
  basics: { name: 'Test User', headline: '', email: 't@example.com', phone: '+1', location: '', summary: '', links: [{ label: '', url: '' }] },
  education: [{ institution: 'TU', degree: 'BS', field: 'CS', cgpa: '', startDate: '', endDate: '', location: '' }],
  experience: [],
  projects: [{ title: 'P', projectLink: '', repoLink: '', techStack: [], startDate: '', endDate: '', bullets: [''] }],
  skills: { languages: ['a', 'b', 'c'], frameworks: [], tools: [], other: [] },
  certifications: [],
  accomplishments: [],
  activities: [],
  volunteering: [],
  publications: [],
}

async function seedDraft(page: import('@playwright/test').Page) {
  await page.addInitScript((resume) => {
    sessionStorage.setItem('cvembed:draft', JSON.stringify(resume))
  }, SEED_RESUME)
}

test.describe('PDF engine lazy loading', () => {
  test('mobile: pdf chunk is not fetched on load, only on demand', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only flow')
    await seedDraft(page)

    const pdfRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('pdfRenderer')) pdfRequests.push(request.url())
    })

    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    // Give any (incorrect) idle scheduling time to fire.
    await page.waitForTimeout(5000)
    expect(pdfRequests).toEqual([])

    // Opening the export menu is the on-demand trigger.
    const exportButton = page.locator('.preview-head .tool-btn[title="Export resume"]')
    await exportButton.click()
    await expect(page.locator('.export-dropdown')).toBeVisible()
    await expect.poll(() => pdfRequests.length, { timeout: 15_000 }).toBeGreaterThan(0)
  })

  test('desktop: pdf chunk loads via idle estimate as before', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await seedDraft(page)

    const pdfRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('pdfRenderer')) pdfRequests.push(request.url())
    })

    await page.goto('/builder')
    await expect.poll(() => pdfRequests.length, { timeout: 20_000 }).toBeGreaterThan(0)
  })
})
