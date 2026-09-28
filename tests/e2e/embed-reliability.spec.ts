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

  // autoHeight must shrink the frame to its content. `ready` and `heightChange`
  // are independent postMessages with no ordering guarantee, so waiting for
  // `ready` and sampling the height in the same tick is a race: the frame can
  // still carry the configured height when `ready` lands. Poll the live frame
  // instead of reading it once.
  const frame = page.locator('#sdk-target iframe')
  await expect
    .poll(async () => {
      const height = Number(await frame.getAttribute('height'))
      return height > 0 && height < 1100
    }, { timeout: 15_000 })
    .toBe(true)

  // The resize must have come from the bridge, not from a static attribute.
  // Read the counter only after the poll above, never at `ready`: the counter
  // is empty until a heightChange actually arrives, and sampling it earlier
  // races the very message it is meant to prove.
  const heightMessages = await page.evaluate(
    () => (window as unknown as { __cvHeights?: number[] }).__cvHeights?.length ?? 0,
  )
  expect(heightMessages).toBeGreaterThan(0)
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

test('a malformed update is rejected without breaking the bridge', async ({ page, isMobile }) => {
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
    const heights: number[] = []
    let readyCount = 0

    const instance = sdk.render({
      target,
      baseUrl: origin,
      resumeData: resume,
      height: 900,
      events: {
        onReady: () => { readyCount += 1 },
        onHeightChange: ({ height }) => { heights.push(height) },
      },
    })

    // A malformed baseUrl must throw, and must not corrupt the live config.
    let threw = false
    try {
      instance.update({ baseUrl: 'http://' })
    } catch {
      threw = true
    }

    // A valid update after the failure must still work.
    instance.update({ height: 640 })

    const waitFor = (predicate: () => boolean) => new Promise<void>((resolve) => {
      const started = Date.now()
      const check = () => {
        if (predicate() || Date.now() - started > 10000) {
          resolve()
          return
        }
        window.setTimeout(check, 50)
      }
      check()
    })

    await waitFor(() => readyCount > 0)
    await waitFor(() => heights.length > 0)

    return {
      threw,
      readyCount,
      heightMessages: heights.length,
      srcAfterFailure: instance.getIframe()?.getAttribute('src') ?? '',
    }
  }, { origin: new URL(page.url()).origin, resume: RESUME })

  expect(result.threw).toBe(true)
  // The bridge survived: the embed still signalled ready and resized.
  expect(result.readyCount).toBeGreaterThan(0)
  expect(result.heightMessages).toBeGreaterThan(0)
  expect(result.srcAfterFailure).toContain('/embed/')
  expect(result.srcAfterFailure).not.toContain('http://embed')
  expect(pageErrors).toEqual([])
})

test('onHeightChange never reports a value the iframe was not sized to', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  await page.goto('/builder')
  await page.evaluate(() => {
    document.getElementById('root')!.innerHTML = '<div id="sdk-target"></div>'
  })
  await page.addScriptTag({ url: new URL('/sdk.js?v=2', page.url()).toString() })

  const rejected = await page.evaluate(async ({ origin, resume }) => {
    const target = document.getElementById('sdk-target')!
    const sdk = (window as unknown as SdkWindow).CVEmbed
    const reported: number[] = []
    const instance = sdk.render({
      target,
      baseUrl: origin,
      resumeData: resume,
      height: 640,
      options: { autoHeight: false },
      events: { onHeightChange: ({ height }) => { reported.push(height) } },
    })

    const frame = instance.getIframe()!
    const embedId = new URL(frame.src).searchParams.get('embedId')
    const post = (height: unknown) => {
      frame.contentWindow?.postMessage(
        { source: 'cv-embed', version: '2', event: 'heightChange', embedId, payload: { height } },
        origin,
      )
    }

    post('not-a-number')
    await new Promise((resolve) => window.setTimeout(resolve, 150))
    post(-500)
    await new Promise((resolve) => window.setTimeout(resolve, 150))
    post(999999999)
    await new Promise((resolve) => window.setTimeout(resolve, 150))

    return { reported, applied: Number(frame.getAttribute('height')) }
  }, { origin: new URL(page.url()).origin, resume: RESUME })

  // autoHeight is off, so nothing is applied; every report must be a real number
  // that matches the iframe rather than NaN, a negative, or an uncapped value.
  for (const height of rejected.reported) {
    expect(Number.isFinite(height)).toBe(true)
    expect(height).toBe(rejected.applied)
  }
})
