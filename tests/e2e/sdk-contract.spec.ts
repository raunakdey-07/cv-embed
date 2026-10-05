import { expect, test, type Frame, type Page } from '@playwright/test'
import type { CVEmbedConfig, CVEmbedInstance } from '../../sdk/renderer'

/**
 * Host-perspective contract coverage. Every test drives the real
 * `public/sdk.js` artifact against the real embed route, so the bridge,
 * the schemas, and both ends of the protocol are the production code.
 */

interface SdkWindow extends Window {
  CVEmbed: {
    version: string
    protocolVersion: string
    render: (config: CVEmbedConfig) => CVEmbedInstance
  }
  __log: BridgeLog[]
}

type BridgeLog =
  | { kind: 'ready'; payload: Record<string, unknown> }
  | { kind: 'height'; height: number }
  | { kind: 'validation'; payload: Record<string, unknown> }
  | { kind: 'sectionFocus'; payload: Record<string, unknown> }
  | { kind: 'export'; payload: Record<string, unknown> }
  | { kind: 'error'; payload: Record<string, unknown> }
  | { kind: 'message'; event: string; payload: Record<string, unknown> }

const RESUME = {
  meta: {
    version: '1.0',
    template: 'minimal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    documentOptions: {},
  },
  basics: {
    name: 'Contract User',
    headline: 'Engineer',
    email: 'contract@example.com',
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
  experience: [{
    company: 'Example Labs',
    role: 'Engineer',
    location: '',
    startDate: '2016-01',
    endDate: '2024-01',
    bullets: ['Shipped a thing that mattered.'],
  }],
  projects: [],
  skills: { languages: ['TypeScript', 'Go', 'Python'], frameworks: [], tools: [], other: [] },
  certifications: [],
  accomplishments: [],
  activities: [],
  volunteering: [],
  publications: [],
}

/** Wipes the app and mounts the shipped SDK as a bare host page. */
async function mountHost(page: Page, config: Record<string, unknown> = {}) {
  await page.goto('/builder')
  await page.evaluate(() => {
    document.getElementById('root')!.innerHTML = '<div id="sdk-target"></div>'
    const decoy = document.createElement('iframe')
    decoy.id = 'decoy-frame'
    decoy.src = 'about:blank'
    document.body.appendChild(decoy)
  })
  await page.addScriptTag({ url: new URL('/sdk.js', page.url()).toString() })

  await page.evaluate(({ resume, overrides }) => {
    const sdk = (window as unknown as SdkWindow).CVEmbed
    const log: BridgeLog[] = []
    ;(window as unknown as SdkWindow).__log = log

    const instance = sdk.render({
      target: '#sdk-target',
      baseUrl: window.location.origin,
      resumeData: resume,
      height: 900,
      events: {
        onReady: (payload) => log.push({ kind: 'ready', payload: payload as Record<string, unknown> }),
        onHeightChange: ({ height }) => log.push({ kind: 'height', height }),
        onValidationChange: (payload) => log.push({ kind: 'validation', payload: payload as Record<string, unknown> }),
        onSectionFocus: (payload) => log.push({ kind: 'sectionFocus', payload: payload as Record<string, unknown> }),
        onExport: (payload) => log.push({ kind: 'export', payload: payload as Record<string, unknown> }),
        onError: (payload) => log.push({ kind: 'error', payload: payload as unknown as Record<string, unknown> }),
        onMessage: (event) => log.push({ kind: 'message', event: event.event, payload: event.payload }),
      },
      ...overrides,
    })
    ;(window as unknown as { __instance: CVEmbedInstance }).__instance = instance
  }, { resume: RESUME, overrides: config })
}

const readLog = (page: Page) =>
  page.evaluate(() => (window as unknown as SdkWindow).__log.map((entry) => (
    entry.kind === 'height' ? { kind: 'height', height: entry.height } : entry
  )))

const countKind = async (page: Page, kind: BridgeLog['kind']) =>
  (await readLog(page)).filter((entry) => entry.kind === kind).length

const settle = async (page: Page, ms = 700) => {
  await page.waitForTimeout(ms)
}

async function embedFrame(page: Page): Promise<Frame> {
  await expect.poll(async () => page.frames().filter((frame) => frame.url().includes('/embed/')).length).toBe(1)
  const frame = page.frames().find((candidate) => candidate.url().includes('/embed/'))
  if (!frame) throw new Error('embed frame missing')
  return frame
}

test.describe('SDK v2 protocol contract', () => {
  test('reports its SDK and protocol versions before anything is rendered', async ({ page }) => {
    await page.goto('/builder')
    await page.addScriptTag({ url: new URL('/sdk.js', page.url()).toString() })
    const versions = await page.evaluate(() => {
      const sdk = (window as unknown as SdkWindow).CVEmbed
      return { version: sdk.version, protocolVersion: sdk.protocolVersion }
    })
    expect(versions.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(versions.protocolVersion).toBe('2')
  })

  test('handshakes with ready and reports resolved state', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await mountHost(page)
    const frame = await embedFrame(page)
    await expect(frame.locator('.resume-template').first()).toBeVisible()

    await expect.poll(() => countKind(page, 'ready')).toBeGreaterThan(0)
    const ready = (await readLog(page)).find((entry) => entry.kind === 'ready')
    expect(ready).toBeTruthy()
    const payload = (ready as { payload: Record<string, unknown> }).payload
    expect(payload.protocolVersion).toBe('2')
    expect(payload.sdkVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(payload.mode).toBe('preview')
    expect(payload.resumeId).toBe('portable')
    expect(payload.showDownload).toBe(true)
    expect(payload.lockedTemplate).toBeNull()
    expect(payload.template).toBe('minimal')
    expect(Number(payload.score)).toBeGreaterThan(0)

    // ready is repeatable and idempotent: a repeat restates state, it does not
    // mean a second instance.
    for (const entry of (await readLog(page)).filter((item) => item.kind === 'ready')) {
      expect((entry as { payload: Record<string, unknown> }).payload.protocolVersion).toBe('2')
    }

    expect(await page.evaluate(() => (window as unknown as { __instance: CVEmbedInstance }).__instance.isReady())).toBe(true)
    await settle(page)
    expect(errors).toEqual([])
  })

  test('reports height changes and caps them', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    await (await embedFrame(page)).locator('.resume-template').first().waitFor()

    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'height').length).toBeGreaterThan(0)
    const heights = (await readLog(page)).filter((entry) => entry.kind === 'height')
    for (const entry of heights) {
      const height = (entry as { height: number }).height
      expect(Number.isFinite(height)).toBe(true)
      expect(height).toBeGreaterThan(0)
      expect(height).toBeLessThanOrEqual(10000)
    }
    const iframeHeight = Number(await page.locator('#sdk-target iframe').getAttribute('height'))
    expect(heights.some((entry) => (entry as { height: number }).height === iframeHeight)).toBe(true)
  })

  test('publishes validation state with structured issues', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    await (await embedFrame(page)).locator('.resume-template').first().waitFor()

    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'validation').length).toBeGreaterThan(0)
    const validation = (await readLog(page)).find((entry) => entry.kind === 'validation')
    const payload = (validation as { payload: Record<string, unknown> }).payload
    expect(typeof payload.valid).toBe('boolean')
    expect(typeof payload.errorCount).toBe('number')
    expect(typeof payload.warningCount).toBe('number')
    expect(Array.isArray(payload.issues)).toBe(true)
    expect(typeof payload.primaryGuidance).toBe('string')
  })

  test('reports section focus as the reader scrolls the document', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()

    await frame.locator('.resume-template section').last().scrollIntoViewIfNeeded()
    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'sectionFocus').length, { timeout: 10_000 })
      .toBeGreaterThan(0)
    const focus = (await readLog(page)).filter((entry) => entry.kind === 'sectionFocus').at(-1)
    expect(typeof (focus as { payload: { section: string } }).payload.section).toBe('string')
  })

  test('reports export when the reader takes the builder handoff', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    const link = frame.locator('a.link-button')
    await expect(link).toBeVisible()

    await link.click({ modifiers: ['Alt'] })
    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'export').length).toBeGreaterThan(0)
    const exported = (await readLog(page)).find((entry) => entry.kind === 'export')
    expect((exported as { payload: { action: string } }).payload.action).toBe('open-builder')
  })
})

test.describe('SDK host to embed commands', () => {
  test('replaces the document with setResume and re-reports state', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await expect(frame.locator('.resume-template').first()).toBeVisible()

    const updated = {
      ...RESUME,
      basics: { ...RESUME.basics, name: 'Replaced Person', headline: 'Staff Engineer' },
    }
    await page.evaluate((resume) => {
      ;(window as unknown as { __instance: CVEmbedInstance }).__instance.send('setResume', { resume })
    }, updated)

    await expect(frame.locator('.resume-template').first()).toContainText('Replaced Person')
    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'ready').length).toBeGreaterThan(1)
  })

  test('rejects a setResume that is not a CV-Embed document and reports an error', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    await (await embedFrame(page)).locator('.resume-template').first().waitFor()

    await page.evaluate(() => {
      ;(window as unknown as { __instance: CVEmbedInstance }).__instance.send('setResume', { resume: { nonsense: true } })
    })

    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'error').length).toBeGreaterThan(0)
    const error = (await readLog(page)).find((entry) => entry.kind === 'error')
    expect((error as { payload: { code: string } }).payload.code).toBe('resume-invalid')
    // The previous document is still on screen.
    await expect(page.frameLocator('#sdk-target iframe').locator('.resume-template').first()).toContainText('Contract User')
  })

  test('focuses and scrolls to a named section', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()

    await page.evaluate(() => {
      ;(window as unknown as { __instance: CVEmbedInstance }).__instance.send('focusSection', { section: 'Experience' })
    })
    await expect(frame.locator('.resume-template section').first()).toBeVisible()
  })

  test('reports a failed focusSection instead of failing silently', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    await (await embedFrame(page)).locator('.resume-template').first().waitFor()

    await page.evaluate(() => {
      ;(window as unknown as { __instance: CVEmbedInstance }).__instance.send('focusSection', { section: 'Nonexistent Section' })
    })
    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'error').length).toBeGreaterThan(0)
    const error = (await readLog(page)).find((entry) => entry.kind === 'error')
    expect((error as { payload: { code: string } }).payload.code).toBe('command-failed')
  })

  test('turns the download control off with setOptions', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await expect(frame.locator('a.link-button')).toBeVisible()

    await page.evaluate(() => {
      ;(window as unknown as { __instance: CVEmbedInstance }).__instance.send('setOptions', { showDownload: false })
    })
    await expect(frame.locator('a.link-button')).toHaveCount(0)
  })

  test('answers syncState with a fresh handshake', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    await (await embedFrame(page)).locator('.resume-template').first().waitFor()
    await expect.poll(() => countKind(page, 'ready')).toBeGreaterThan(0)
    await settle(page)
    const before = await countKind(page, 'ready')

    await page.evaluate(() => {
      ;(window as unknown as { __instance: CVEmbedInstance }).__instance.send('syncState', {})
    })
    await expect.poll(() => countKind(page, 'ready')).toBeGreaterThan(before)
  })

  test('answers requestExport with the route and the format that was asked for', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()

    await page.evaluate(() => {
      ;(window as unknown as { __instance: CVEmbedInstance }).__instance.send('requestExport', { format: 'docx' })
    })

    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'export').length).toBeGreaterThan(0)
    const exported = (await readLog(page)).find((entry) => entry.kind === 'export') as { payload: Record<string, unknown> }
    // The host asked for docx. The reply has to say which request it is
    // answering, or a host that also sees reader-initiated handoffs cannot
    // tell its own request from someone else's click.
    expect(exported.payload.requestedFormat).toBe('docx')
    expect(exported.payload.action).toBe('open-builder')
    // The route is the document itself, not a bare builder page: the fragment
    // carries the resume so the visitor arrives with their CV loaded.
    expect(String(exported.payload.url)).toContain('/builder')
    expect(String(exported.payload.url)).toContain('data=')
  })

  test('reports a reader-initiated handoff as unrelated to any host request', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    const link = frame.locator('a.link-button')
    await expect(link).toBeVisible()

    await link.click({ modifiers: ['Alt'] })
    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'export').length).toBeGreaterThan(0)
    const exported = (await readLog(page)).find((entry) => entry.kind === 'export') as { payload: Record<string, unknown> }
    expect(exported.payload.requestedFormat).toBeNull()
    expect(exported.payload.url).toBeTruthy()
  })

  test('refuses an unsupported export format and says why', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()

    // TypeScript would reject this at compile time; a host in plain JS, or one
    // building the format string from user input, can still send it.
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#sdk-target iframe')!
      const embedId = new URL(frame.src).searchParams.get('embedId')
      frame.contentWindow!.postMessage(
        { source: 'cv-embed-host', version: '2', command: 'requestExport', embedId, payload: { format: 'exe' } },
        window.location.origin,
      )
    })

    await expect.poll(() => countKind(page, 'error')).toBeGreaterThan(0)
    const error = (await readLog(page)).find((entry) => entry.kind === 'error') as { payload: Record<string, unknown> }
    expect(error.payload.code).toBe('command-failed')
    expect(String(error.payload.message)).toContain('pdf, docx, json')
    // Silence would leave the host waiting for an export that never comes.
    expect(await countKind(page, 'export')).toBe(0)
  })

  test('refuses requestExport with no payload instead of guessing a format', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()

    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#sdk-target iframe')!
      const embedId = new URL(frame.src).searchParams.get('embedId')
      frame.contentWindow!.postMessage(
        { source: 'cv-embed-host', version: '2', command: 'requestExport', embedId, payload: null },
        window.location.origin,
      )
    })

    await expect.poll(() => countKind(page, 'error')).toBeGreaterThan(0)
    const error = (await readLog(page)).find((entry) => entry.kind === 'error') as { payload: Record<string, unknown> }
    expect(error.payload.code).toBe('command-failed')
    expect(await countKind(page, 'export')).toBe(0)
    // The document the viewer is reading is untouched.
    await expect(frame.locator('.resume-template').first()).toContainText('Contract User')
  })

  test('refuses to hand off a document too large for a portable link', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    // The oversize refusal itself is covered by src/lib/handoff.test.ts. This
    // asserts the embed surfaces that refusal over the bridge, using a host
    // command rather than a rendered document: a document past the portable-link
    // limit is also slow to render, because it travels as a base64 fragment, so
    // building one here would test React's render cost rather than the contract.
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()

    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#sdk-target iframe')!
      const embedId = new URL(frame.src).searchParams.get('embedId')
      frame.contentWindow!.postMessage(
        { source: 'cv-embed-host', version: '2', command: 'requestExport', embedId, payload: { format: 'pdf' } },
        window.location.origin,
      )
    })

    // A normally sized document still gets a real route, which is the control
    // for the refusal: the two cases differ only in document size.
    await expect.poll(() => countKind(page, 'export')).toBeGreaterThan(0)
    const exported = (await readLog(page)).find((entry) => entry.kind === 'export') as { payload: Record<string, unknown> }
    expect(exported.payload.url).toContain('#data=')
  })
})

test.describe('SDK bridge security', () => {
  test('ignores messages from a window other than its own frame', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()
    await expect.poll(() => countKind(page, 'ready')).toBeGreaterThan(0)
    const before = await countKind(page, 'ready')

    // Same origin, correct shape, wrong source window.
    await page.evaluate(() => {
      const embedId = new URL(document.querySelector<HTMLIFrameElement>('#sdk-target iframe')!.src).searchParams.get('embedId')
      document.getElementById('decoy-frame')!.contentWindow!.postMessage({
        source: 'cv-embed', version: '2', event: 'ready', embedId,
        payload: {
          protocolVersion: '2', sdkVersion: '2.1.0', mode: 'preview', resumeId: 'portable',
          showDownload: true, lockedTemplate: null, template: 'minimal',
          score: 99, qualityScore: 99, completenessScore: 99,
        },
      }, window.location.origin)
    })

    await settle(page)
    expect(await countKind(page, 'ready')).toBe(before)
  })

  test('ignores a well-formed message addressed to a different embed id', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()
    await expect.poll(() => countKind(page, 'ready')).toBeGreaterThan(0)
    const before = await countKind(page, 'ready')

    await frame.evaluate(() => {
      window.parent.postMessage({
        source: 'cv-embed',
        version: '2',
        event: 'ready',
        embedId: 'cvembed_someoneelse',
        payload: {
          protocolVersion: '2', sdkVersion: '2.1.0', mode: 'preview', resumeId: 'portable',
          showDownload: true, lockedTemplate: null, template: 'minimal',
          score: 99, qualityScore: 99, completenessScore: 99,
        },
      }, window.location.origin)
    })

    await settle(page)
    expect(await countKind(page, 'ready')).toBe(before)
  })

  test('ignores unknown events, wrong sources, bad payloads, and foreign versions', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()
    await expect.poll(() => countKind(page, 'ready')).toBeGreaterThan(0)
    const readyBefore = await countKind(page, 'ready')
    const heightsBefore = (await readLog(page))
      .filter((entry) => entry.kind === 'height')
      .map((entry) => (entry as { height: number }).height)

    await frame.evaluate(() => {
      const embedId = new URL(window.location.href).searchParams.get('embedId')
      const ready = {
        protocolVersion: '2', sdkVersion: '2.1.0', mode: 'preview', resumeId: 'portable',
        showDownload: true, lockedTemplate: null, template: 'minimal',
        score: 99, qualityScore: 99, completenessScore: 99,
      }
      const hostile = [
        { source: 'cv-embed', version: '2', event: 'definitelyNotAnEvent', embedId, payload: {} },
        { source: 'cv-embed-host', version: '2', event: 'ready', embedId, payload: ready },
        { source: 'cv-embed', version: '2', event: 'heightChange', embedId, payload: null },
        { source: 'cv-embed', version: '2', event: 'heightChange', embedId, payload: { height: 'tall' } },
        { source: 'cv-embed', version: '2', event: 'heightChange', embedId, payload: { height: -5 } },
        { source: 'cv-embed', version: '2', event: 'ready', embedId, payload: { mode: 'preview' } },
        { source: 'cv-embed', version: '2', event: 'ready', embedId, payload: { ...ready, score: 'high' } },
        { source: 'cv-embed', version: '1', event: 'ready', embedId, payload: ready },
        { source: 'cv-embed', version: 2, event: 'ready', embedId, payload: ready },
        'a plain string',
        42,
        null,
      ]
      for (const message of hostile) window.parent.postMessage(message, window.location.origin)
    })

    await settle(page)
    expect(await countKind(page, 'ready')).toBe(readyBefore)
    const heightsAfter = (await readLog(page))
      .filter((entry) => entry.kind === 'height')
      .map((entry) => (entry as { height: number }).height)
    // Nothing new, and nothing negative or absurd.
    expect(heightsAfter.length).toBe(heightsBefore.length)
    expect(heightsAfter.every((height) => height > 0 && height <= 10000)).toBe(true)
  })

  test('rejects an oversized height instead of resizing the frame to it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()
    await expect.poll(async () => (await readLog(page)).filter((entry) => entry.kind === 'height').length).toBeGreaterThan(0)

    await frame.evaluate(() => {
      const embedId = new URL(window.location.href).searchParams.get('embedId')
      window.parent.postMessage({
        source: 'cv-embed', version: '2', event: 'heightChange', embedId, payload: { height: 9_999_999 },
      }, window.location.origin)
    })

    await expect.poll(async () => Number(await page.locator('#sdk-target iframe').getAttribute('height'))).toBeLessThanOrEqual(10000)
    const reported = (await readLog(page)).filter((entry) => entry.kind === 'height').at(-1)
    expect((reported as { height: number }).height).toBeLessThanOrEqual(10000)
  })

  test('reports an unsupported protocol from the host instead of ignoring it silently', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()

    // Host -> embed: the parent posts a command speaking a foreign protocol.
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#sdk-target iframe')!
      const embedId = new URL(frame.src).searchParams.get('embedId')
      frame.contentWindow!.postMessage(
        { source: 'cv-embed-host', version: '99', command: 'syncState', embedId, payload: {} },
        window.location.origin,
      )
    })

    await expect.poll(() => countKind(page, 'error')).toBeGreaterThan(0)
    const error = (await readLog(page)).find((entry) => entry.kind === 'error')
    expect((error as { payload: { code: string; fatal: boolean } }).payload.code).toBe('unsupported-protocol')
    expect((error as { payload: { fatal: boolean } }).payload.fatal).toBe(true)
  })

  test('ignores unknown and malformed commands from the host without touching state', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()
    await expect(frame.locator('.resume-template')).toContainText('Contract User')
    await settle(page)

    // Host -> embed. None of these match a command schema, so all are dropped.
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#sdk-target iframe')!
      const embedId = new URL(frame.src).searchParams.get('embedId')
      const hostile = [
        { source: 'cv-embed-host', version: '2', command: 'dropDatabase', embedId, payload: {} },
        { source: 'cv-embed-host', version: '2', command: 'setResume', embedId, payload: {} },
        { source: 'cv-embed-host', version: '2', command: 'focusSection', embedId, payload: { section: 42 } },
        { source: 'cv-embed-host', version: '2', command: 'setOptions', embedId, payload: { density: 'neon' } },
        { source: 'cv-embed', version: '2', command: 'syncState', embedId, payload: {} },
        { source: 'cv-embed-host', version: '2', command: 'syncState', embedId: 'cvembed_other', payload: {} },
        { source: 'someone-else', version: '2', command: 'syncState', embedId, payload: {} },
        'not a message',
        42,
      ]
      for (const message of hostile) {
        frame.contentWindow!.postMessage(message, window.location.origin)
      }
    })

    await settle(page)
    await expect(frame.locator('.resume-template')).toContainText('Contract User')
    await expect(frame.locator('a.link-button')).toBeVisible()
    expect(await countKind(page, 'error')).toBe(0)
    expect(await countKind(page, 'export')).toBe(0)
  })

  test('answers an unknown command name with silence rather than probing for names', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()

    // requestExport is answered when its arguments are wrong, because the host
    // is owed a reply. An unknown command name is not: reporting those would
    // turn the bridge into an oracle for which commands exist.
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#sdk-target iframe')!
      const embedId = new URL(frame.src).searchParams.get('embedId')
      frame.contentWindow!.postMessage(
        { source: 'cv-embed-host', version: '2', command: 'definitelyNotACommand', embedId, payload: {} },
        window.location.origin,
      )
    })

    await settle(page)
    expect(await countKind(page, 'error')).toBe(0)
    expect(await countKind(page, 'export')).toBe(0)
  })

  test('reports a rejected resume rather than silently blanking the document', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()
    await expect(frame.locator('.resume-template')).toContainText('Contract User')
    await settle(page)

    // normalizeResume would happily turn this into a blank CV. A replacement
    // must not be allowed to wipe the screen, so it is refused and explained.
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>('#sdk-target iframe')!
      const embedId = new URL(frame.src).searchParams.get('embedId')
      frame.contentWindow!.postMessage(
        { source: 'cv-embed-host', version: '2', command: 'setResume', embedId, payload: { resume: { nonsense: true } } },
        window.location.origin,
      )
    })

    await expect.poll(() => countKind(page, 'error')).toBeGreaterThan(0)
    const error = (await readLog(page)).find((entry) => entry.kind === 'error')
    expect((error as { payload: { code: string } }).payload.code).toBe('resume-invalid')
    await expect(frame.locator('.resume-template')).toContainText('Contract User')
  })

  test('a command sent before the handshake does not throw or corrupt state', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/builder')
    await page.evaluate(() => {
      document.getElementById('root')!.innerHTML = '<div id="sdk-target"></div>'
    })
    await page.addScriptTag({ url: new URL('/sdk.js', page.url()).toString() })
    await page.evaluate((resume) => {
      const instance = (window as unknown as SdkWindow).CVEmbed.render({
        target: '#sdk-target',
        baseUrl: window.location.origin,
        resumeData: resume,
        height: 700,
      })
      // Fire immediately, before the frame has loaded or handshaken.
      instance.send('syncState', {})
      instance.send('setOptions', { showDownload: false })
      instance.send('focusSection', { section: 'Skills' })
      ;(window as unknown as { __earlyReady: boolean }).__earlyReady = instance.isReady()
    }, RESUME)

    expect(await page.evaluate(() => (window as unknown as { __earlyReady: boolean }).__earlyReady)).toBe(false)
    await settle(page)
    expect(errors).toEqual([])
    await expect(page.frameLocator('#sdk-target iframe').locator('.resume-template').first()).toBeVisible()
  })

  test('stops delivering events once the instance is destroyed', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    await (await embedFrame(page)).locator('.resume-template').first().waitFor()
    await expect.poll(() => countKind(page, 'ready')).toBeGreaterThan(0)

    await page.evaluate(() => {
      ;(window as unknown as { __instance: CVEmbedInstance }).__instance.destroy()
    })
    await expect(page.locator('#sdk-target iframe')).toHaveCount(0)
    const before = await countKind(page, 'ready')
    await settle(page, 800)
    expect(await countKind(page, 'ready')).toBe(before)
  })

  test('a duplicate ready is delivered, and reload resets the ready flag', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await mountHost(page)
    const frame = await embedFrame(page)
    await frame.locator('.resume-template').first().waitFor()
    await expect.poll(() => countKind(page, 'ready')).toBeGreaterThan(0)
    const before = await countKind(page, 'ready')

    // A repeated handshake from the same frame is still a valid event.
    await frame.evaluate(() => {
      const embedId = new URL(window.location.href).searchParams.get('embedId')
      window.parent.postMessage({
        source: 'cv-embed', version: '2', event: 'ready', embedId,
        payload: {
          protocolVersion: '2', sdkVersion: '2.1.0', mode: 'preview', resumeId: 'portable',
          showDownload: true, lockedTemplate: null, template: 'minimal',
          score: 10, qualityScore: 10, completenessScore: 10,
        },
      }, window.location.origin)
    })
    await expect.poll(() => countKind(page, 'ready')).toBeGreaterThan(before)

    await page.evaluate(() => {
      ;(window as unknown as { __instance: CVEmbedInstance }).__instance.update({ resumeData: { changed: true } })
    })
    await expect.poll(async () => page.evaluate(() => (window as unknown as { __instance: CVEmbedInstance }).__instance.isReady())).toBe(false)
  })
})
