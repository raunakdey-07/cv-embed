import { expect, test } from '@playwright/test'

const now = new Date().toISOString()

function resumeWith(overrides: Record<string, unknown> = {}) {
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
        sectionOrder: [
          'summary',
          'education',
          'experience',
          'projects',
          'skills',
          'certifications',
          'accomplishments',
          'activities',
          'volunteering',
          'publications',
        ],
      },
    },
    basics: { name: 'Tech User', headline: '', email: '', phone: '', location: '', summary: '', links: [] },
    education: [],
    experience: [],
    projects: [{ title: 'Project', projectLink: '', repoLink: '', techStack: [], startDate: '', endDate: '', bullets: [''] }],
    skills: { languages: [], frameworks: [], tools: [], other: [] },
    certifications: [],
    accomplishments: [],
    activities: [],
    volunteering: [],
    publications: [],
    ...overrides,
  }
}

const storedTechStack = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cvembed:draft') ?? '{}').projects?.[0]?.techStack)

test.describe('comma separated list editing', () => {
  test('typing commas and spaces keeps every technology as its own entry', async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('cvembed:draft', JSON.stringify(value))
    }, resumeWith())

    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()
    await page.locator('.nav-tab', { hasText: 'Projects' }).click()

    const field = page.locator('input[name="project-0-tech"]')
    await field.click()
    await field.pressSequentially('Go, Postgres, Kafka', { delay: 20 })

    // The field must show exactly what was typed, commas and spaces intact.
    await expect(field).toHaveValue('Go, Postgres, Kafka')
    await expect.poll(() => storedTechStack(page)).toEqual(['Go', 'Postgres', 'Kafka'])
  })

  test('editing the middle of the list and deleting a comma behave predictably', async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('cvembed:draft', JSON.stringify(value))
    }, resumeWith())

    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()
    await page.locator('.nav-tab', { hasText: 'Projects' }).click()

    const field = page.locator('input[name="project-0-tech"]')
    await field.click()
    await field.pressSequentially('Go, Postgres, Kafka', { delay: 20 })
    await expect.poll(() => storedTechStack(page)).toEqual(['Go', 'Postgres', 'Kafka'])

    // Remove the first comma. The raw text is preserved exactly, so the two
    // values simply merge into a single "Go Postgres" entry.
    await field.press('Home')
    for (let index = 0; index < 3; index += 1) await field.press('ArrowRight')
    await field.press('Backspace')
    await expect(field).toHaveValue('Go Postgres, Kafka')
    await expect.poll(() => storedTechStack(page)).toEqual(['Go Postgres', 'Kafka'])
  })

  test('a pasted list and a trailing comma both settle correctly on blur', async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('cvembed:draft', JSON.stringify(value))
    }, resumeWith())

    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()
    await page.locator('.nav-tab', { hasText: 'Projects' }).click()

    const field = page.locator('input[name="project-0-tech"]')
    await field.click()
    await field.fill('React, Node, Vite,')
    await expect.poll(() => storedTechStack(page)).toEqual(['React', 'Node', 'Vite'])

    // Blur tidies the raw text without changing what is stored.
    await page.locator('input[name="name"]').click()
    await expect(field).toHaveValue('React, Node, Vite')
    await expect.poll(() => storedTechStack(page)).toEqual(['React', 'Node', 'Vite'])
  })

  test('an emptied field stores no technologies', async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('cvembed:draft', JSON.stringify(value))
    }, resumeWith())

    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()
    await page.locator('.nav-tab', { hasText: 'Projects' }).click()

    const field = page.locator('input[name="project-0-tech"]')
    await field.click()
    await field.pressSequentially('Go, Postgres', { delay: 20 })
    await expect.poll(() => storedTechStack(page)).toEqual(['Go', 'Postgres'])

    await field.fill('')
    await expect.poll(() => storedTechStack(page)).toEqual([])
  })
})
