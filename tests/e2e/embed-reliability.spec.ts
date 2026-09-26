import { expect, test } from '@playwright/test'
import type { CVEmbedConfig, CVEmbedInstance } from '../../sdk/renderer'

type SdkWindow = Window & {
  CVEmbed: { render: (config: CVEmbedConfig) => CVEmbedInstance }
}

const RESUME = {
  meta: {
    version: '1.0',
    template: 'minimal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    documentOptions: {},
  },
  basics: {
    name: 'SDK Handoff User',
    headline: 'Engineer',
    email: 'sdk@example.com',
    phone: '+1 555 0100',
    location: 'Remote',
    summary: 'Builds reliable tools.',
    links: [],
  },
  education: [{
    institution: 'Example University',
    degree: 'BS',
    field: 'Computer Science',
    cgpa: '',
    startDate: '2020-01',
    endDate: '2024-01',
    location: '',
  }],
  experience: [],
  projects: [{
    title: 'Example Project',
    projectLink: '',
    repoLink: '',
    techStack: [],
    startDate: '',
    endDate: '',
    bullets: ['Built a useful tool.'],
  }],
  skills: { languages: ['TypeScript', 'React', 'Node'], frameworks: [], tools: [], other: [] },
  certifications: [],
  accomplishments: [],
  activities: [],
  volunteering: [],
  publications: [],
}

test('embed CTA hands the visible resume to the builder', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  await page.addInitScript((resume) => {
    sessionStorage.setItem('cvembed:draft', JSON.stringify(resume))
  }, RESUME)
  await page.goto('/builder')

  await page.locator('.header-embed-btn').click()
  await page.locator('.embed-preset-select').selectOption('portfolio')
  const href = await page.locator('a[aria-label="Open embed URL"]').getAttribute('href')
  expect(href).toBeTruthy()

  const embed = await context.newPage()
  await embed.goto(href!)
  const builderPagePromise = context.waitForEvent('page')
  await embed.getByRole('link', { name: 'Open in Builder' }).click()
  const builder = await builderPagePromise
  await builder.waitForLoadState('domcontentloaded')
  await expect(builder.locator('#section-basics input').first()).toHaveValue('SDK Handoff User')
  expect(builder.url()).not.toContain('#data=')
  await builder.close()
  await embed.close()
})

test('SDK applies template lock, shrinks height, and replaces prior instances', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/builder')
  await page.evaluate(() => {
    document.getElementById('root')!.innerHTML = '<div id="sdk-target"></div>'
  })
  await page.addScriptTag({ url: new URL('/sdk.js?v=2', page.url()).toString() })

  const result = await page.evaluate(async ({ origin, resume }) => {
    const target = document.getElementById('sdk-target')!
    const sdk = (window as unknown as SdkWindow).CVEmbed
    const observedHeights: number[] = []
    ;(window as unknown as { __cvHeights: number[] }).__cvHeights = observedHeights
    const first = sdk.render({
      target,
      baseUrl: origin,
      resumeData: resume,
      height: 1100,
    })
    const firstFrame = first.getIframe()
    if (!firstFrame) throw new Error('SDK did not create an iframe')
    first.update({ height: 600 })

    let ready = false
    const second = sdk.render({
      target,
      baseUrl: origin,
      resumeData: resume,
      height: 1100,
      options: { autoHeight: true, lockedTemplate: 'compact' },
      events: {
        onReady: () => { ready = true },
        onHeightChange: ({ height }) => { observedHeights.push(height) },
      },
    })

    await new Promise<void>((resolve) => {
      const started = Date.now()
      const check = () => {
        if (ready || Date.now() - started > 10000) {
          resolve()
          return
        }
        window.setTimeout(check, 50)
      }
      check()
    })

    return {
      ready,
      iframeCount: target.querySelectorAll('iframe').length,
      firstStillConnected: firstFrame.isConnected,
      finalHeight: Number(second.getIframe()?.getAttribute('height') ?? 0),
    }
  }, { origin: new URL(page.url()).origin, resume: RESUME })

  expect(result.ready).toBe(true)
  expect(result.iframeCount).toBe(1)
  expect(result.firstStillConnected).toBe(false)
  expect(result.finalHeight).toBeGreaterThan(0)
  expect(result.finalHeight).toBeLessThan(1100)
  await expect(page.frameLocator('iframe').locator('.resume-template.template-compact')).toBeVisible()

  await page.evaluate(() => {
    const frame = document.querySelector('iframe')
    if (!frame) throw new Error('SDK iframe missing')
    const embedId = new URL(frame.src).searchParams.get('embedId')
    window.postMessage({ source: 'cv-embed', version: '2', event: 'heightChange', embedId, payload: null }, window.location.origin)
  })
  await page.waitForTimeout(200)
  expect(pageErrors).toEqual([])
})
