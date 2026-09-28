import { expect, test } from '@playwright/test'

function resumeWith(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  return {
    meta: {
      version: '1.0',
      template: 'minimal',
      createdAt: now,
      updatedAt: now,
      documentOptions: {
        accentColor: '#111111',
        fontFamily: 'satoshi',
        fontSize: 'normal',
        lineHeight: 'normal',
        sectionHeadingStyle: 'rule',
        bulletStyle: 'dot',
        dateStyle: 'range',
        density: 'comfortable',
        linkDisplay: 'label',
        headerAlignment: 'center',
        showSections: {
          summary: true,
          education: true,
          experience: true,
          projects: true,
          skills: true,
          certifications: false,
          accomplishments: false,
          activities: false,
          volunteering: false,
          publications: false,
        },
        sectionOrder: ['summary', 'education', 'experience', 'projects', 'skills', 'certifications', 'accomplishments', 'activities', 'volunteering', 'publications'],
      },
    },
    basics: { name: 'Page Count User', headline: '', email: 'page@example.com', phone: '1', location: '', summary: 'A concise summary.', links: [] },
    education: [{ institution: 'School', degree: 'BS', field: 'CS', cgpa: '', startDate: '', endDate: '', location: '' }],
    experience: [],
    projects: [{ title: 'Project', projectLink: '', repoLink: '', techStack: [], startDate: '', endDate: '', bullets: ['Built a useful tool.'] }],
    skills: { languages: ['TypeScript', 'React', 'Node'], frameworks: [], tools: [], other: [] },
    certifications: [], accomplishments: [], activities: [], volunteering: [], publications: [],
    ...overrides,
  }
}

test('fresh CV shows the five core sections as empty and scores zero', async ({ page, isMobile }) => {
  const pdfRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('pdfRenderer')) pdfRequests.push(request.url())
  })

  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()
  await expect(page.locator('.completion-value')).toHaveText('0%')
  await expect(page.getByText('Add your name and contact details to begin.')).toBeVisible()

  const navLabels = await page.locator('.section-nav-tabs .nav-tab').allTextContents()
  expect(navLabels).toEqual(['Summary', 'Education', 'Experience', 'Projects', 'Skills'])
  for (const sectionName of ['Summary', 'Education', 'Experience', 'Projects', 'Skills']) {
    await expect(page.getByRole('heading', { name: sectionName, exact: true })).toBeVisible()
  }
  await expect(page.locator('#section-education')).toContainText('No education added yet.')
  await expect(page.locator('#section-experience')).toContainText('No experience added yet.')
  await expect(page.locator('#section-projects')).toContainText('No projects added yet.')
  await expect(page.locator('#section-skills .count-badge')).toHaveText('0')
  await expect(page.locator('.nav-tab', { hasText: 'Certifications' })).toHaveCount(0)

  if (isMobile) {
    await page.getByRole('button', { name: 'Preview' }).click()
  }
  await expect(page.getByText('Quality: 0/100')).toBeVisible()
  await expect(page.locator('.page-indicator')).toHaveText('Preview pages: 1')
  await page.waitForTimeout(1500)
  expect(pdfRequests).toEqual([])
})

test('an empty CV refuses to export rather than producing a document with a placeholder name', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  const downloads: string[] = []
  page.on('download', (download) => downloads.push(download.suggestedFilename()))

  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()
  await page.locator('.tool-btn[title="Export resume"]').click()
  await page.locator('.export-dropdown').waitFor({ state: 'visible' })

  await page.locator('.export-dropdown').getByText('PDF', { exact: false }).first().click()
  await expect(page.getByText(/Add your name and at least one section before exporting/)).toBeVisible()

  await page.locator('.tool-btn[title="Export resume"]').click()
  await page.locator('.export-dropdown').getByText('DOCX', { exact: false }).first().click()
  await expect(page.getByText(/Add your name and at least one section before exporting/)).toBeVisible()

  await page.waitForTimeout(500)
  expect(downloads).toEqual([])
})

test('a CV with real content still exports', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  const downloads: string[] = []
  page.on('download', (download) => downloads.push(download.suggestedFilename()))

  await page.addInitScript((value) => {
    sessionStorage.setItem('cvembed:draft', JSON.stringify(value))
  }, resumeWith())
  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  await page.locator('.tool-btn[title="Export resume"]').click()
  await page.locator('.export-dropdown').waitFor({ state: 'visible' })
  await page.locator('.export-dropdown').getByText('PDF', { exact: false }).first().click()

  await expect.poll(() => downloads.length, { timeout: 30_000 }).toBeGreaterThan(0)
  expect(downloads[0]).toContain('Page Count User')
})

test('an unreadable saved draft is preserved instead of being overwritten', async ({ page }) => {
  // A draft written by a different app version: the shape parses but the schema
  // rejects it, which is the realistic way a saved CV becomes unreadable.
  const future = resumeWith()
  future.meta.version = '99.0'
  const corrupt = JSON.stringify(future)

  await page.addInitScript((value) => {
    localStorage.setItem('cvembed:draft', value)
  }, corrupt)

  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  // The user is told rather than silently shown an empty CV.
  await expect(page.getByText(/saved CV could not be read/i)).toBeVisible()

  // Give the debounced autosave more than enough time to run if it were going to.
  await page.waitForTimeout(1500)
  const preserved = await page.evaluate(() => ({
    quarantined: localStorage.getItem('cvembed:draft:unreadable'),
    draftKey: localStorage.getItem('cvembed:draft'),
  }))
  expect(preserved.quarantined).toBe(corrupt)
  expect(preserved.draftKey).toBeNull()
})

test('a partially written draft that normalizes cleanly still loads', async ({ page }) => {
  const partial = { basics: { name: 'Recovered User', email: 'r@example.com' } }
  await page.addInitScript((value) => {
    localStorage.setItem('cvembed:draft', value)
  }, JSON.stringify(partial))

  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()
  await expect(page.locator('input[name="name"]')).toHaveValue('Recovered User')
  const quarantined = await page.evaluate(() => localStorage.getItem('cvembed:draft:unreadable'))
  expect(quarantined).toBeNull()
})

test('a valid draft still loads and is not quarantined', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('cvembed:draft', JSON.stringify(value))
  }, resumeWith())
  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  await expect(page.locator('input[name="name"]')).toHaveValue('Page Count User')
  const quarantined = await page.evaluate(() => localStorage.getItem('cvembed:draft:unreadable'))
  expect(quarantined).toBeNull()
})

test('builder reflows without page-level horizontal scrolling', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only flow')

  for (const width of [280, 320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const widths = await page.evaluate(() => ({
      docClient: document.documentElement.clientWidth,
      docScroll: document.documentElement.scrollWidth,
      bodyClient: document.body.clientWidth,
      bodyScroll: document.body.scrollWidth,
    }))
    const message = `${width}px: ${JSON.stringify(widths)}`
    expect(widths.docScroll, message).toBeLessThanOrEqual(widths.docClient + 1)
    expect(widths.bodyScroll, message).toBeLessThanOrEqual(widths.bodyClient + 1)
  }
})

test('persisted visibility is not replaced by the default configuration', async ({ page }) => {
  const persisted = resumeWith()
  persisted.meta.documentOptions.showSections.summary = false
  persisted.meta.documentOptions.showSections.education = false
  persisted.meta.documentOptions.showSections.experience = true
  persisted.meta.documentOptions.showSections.projects = false
  persisted.meta.documentOptions.showSections.skills = true
  await page.addInitScript((value) => {
    localStorage.setItem('cvembed:draft', JSON.stringify(value))
  }, persisted)

  await page.goto('/builder')
  const navLabels = await page.locator('.section-nav-tabs .nav-tab').allTextContents()
  expect(navLabels).toEqual(['Experience', 'Skills'])
  await expect(page.locator('#section-summary')).toHaveCount(0)
  await expect(page.locator('#section-education')).toHaveCount(0)
  await expect(page.locator('#section-projects')).toHaveCount(0)
})

test('non-empty page count is measured after export is opened', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  const pdfRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('pdfRenderer')) pdfRequests.push(request.url())
  })
  await page.addInitScript((value) => {
    sessionStorage.setItem('cvembed:draft', JSON.stringify(value))
  }, resumeWith())

  await page.goto('/builder')
  await expect(page.locator('.page-indicator')).toHaveText('PDF pages: not checked')
  await page.locator('.tool-btn[title="Export resume"]').click()
  await expect.poll(async () => (await page.locator('.page-indicator').textContent()).replace('Est. PDF pages', 'PDF pages')).toBe('PDF pages: 1')
  expect(pdfRequests.length).toBeGreaterThan(0)
})

test('long content reports a measured multi-page count', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  const longResume = resumeWith()
  longResume.experience = [{
    company: 'Example Labs',
    role: 'Engineer',
    location: '',
    startDate: '2020-01',
    endDate: '',
    bullets: Array.from({ length: 30 }, (_, index) => `Delivered project outcome ${index + 1}. ${'Detailed delivery notes with measurable business impact. '.repeat(10)}`),
  }]
  await page.addInitScript((value) => {
    sessionStorage.setItem('cvembed:draft', JSON.stringify(value))
  }, longResume)

  await page.goto('/builder')
  await page.locator('.tool-btn[title="Export resume"]').click()
  await expect.poll(async () => {
    const text = ((await page.locator('.page-indicator').textContent()) ?? '').replace('Est. PDF pages', 'PDF pages')
    const match = text.match(/PDF pages: (\d+)/)
    return match ? Number(match[1]) : 0
  }, { timeout: 30_000 }).toBeGreaterThan(1)
})
