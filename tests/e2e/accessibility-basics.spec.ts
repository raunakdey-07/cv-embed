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

  // Read the indicator from a form field, which used to drop `outline` on
  // focus. The earlier version of this check used optional chaining around a
  // selector: a missing element produced undefined, every `not.toBe` assertion
  // passed anyway, and renaming the button would have left the test green. The
  // selector result is asserted before it is used.
  const indicator = await page.evaluate(() => {
    const element = document.querySelector<HTMLInputElement>('#section-basics input')
    if (!element) return null
    element.focus()
    const style = getComputedStyle(element)
    const toRgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number) as [number, number, number]
    const luminance = ([r, g, b]: [number, number, number]) => {
      const channel = (value: number) => {
        const s = value / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const outline = luminance(toRgb(style.outlineColor))
    const behind = luminance(toRgb(style.backgroundColor))
    return {
      focused: document.activeElement === element,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      // Measured against what the outline actually sits on. An outline that
      // matches its surroundings is not an indicator.
      contrast: (Math.max(outline, behind) + 0.05) / (Math.min(outline, behind) + 0.05),
    }
  })

  expect(indicator, 'the name field exists').not.toBeNull()
  expect(indicator?.focused, 'the field took focus').toBe(true)
  expect(indicator?.outlineStyle).toBe('solid')
  expect(Number.parseFloat(indicator?.outlineWidth ?? '0')).toBeGreaterThanOrEqual(2)
  expect(indicator?.contrast ?? 0).toBeGreaterThan(3)
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

test('readiness explanations are described by their trigger, not hidden while visible', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  // These panels are revealed on hover and on focus as well as on click, so
  // marking them aria-hidden until the click state changed made content that
  // was on screen for sighted keyboard users unreadable to assistive tech.
  // The Clean variant renders in place of the issue pill, not alongside it, so
  // this reads whichever pair is on screen.
  const explanations = await page.evaluate(() => {
    const pairs: [string, string][] = [
      ['.completion-info-btn', '#readiness-details'],
      ['.score-pill', '#scoring-rubric'],
      ['.completion-pill-action', '#fix-next-details'],
      ['.completion-pill.ok', '#clean-details'],
    ]
    return pairs.map(([trigger, panel]) => {
      const button = document.querySelector(trigger)
      const target = document.querySelector(panel)
      return {
        trigger,
        rendered: button !== null && target !== null,
        describedBy: button?.getAttribute('aria-describedby') ?? null,
        describesTarget: document.getElementById(button?.getAttribute('aria-describedby') ?? '') !== null,
        panelHidden: target?.getAttribute('aria-hidden') ?? null,
        panelRole: target?.getAttribute('role') ?? null,
        panelText: (target?.textContent ?? '').trim().length,
      }
    }).filter((item) => item.rendered)
  })

  expect(explanations.length, 'the two unconditional panels rendered').toBeGreaterThanOrEqual(2)
  for (const item of explanations) {
    // aria-describedby takes element ids, not selectors.
    expect(item.describedBy, `${item.trigger} describes its panel`).toMatch(/^[\w-]+$/)
    expect(item.describesTarget, `${item.trigger} points at an element that exists`).toBe(true)
    expect(item.panelHidden, `${item.trigger} panel is not aria-hidden`).toBeNull()
    expect(item.panelRole, `${item.trigger} panel is not a transient tooltip`).toBeNull()
    expect(item.panelText, `${item.trigger} panel has content`).toBeGreaterThan(0)
  }

  // The error and warning counts are part of what the pill means, so they have
  // to be in its accessible name rather than hidden behind an aria-label that
  // replaced the visible text.
  const label = await page.locator('.completion-pill-action').first().getAttribute('aria-label')
  expect(label).toMatch(/\d+E \/ \d+W/)
})

test('the save indicator announces state changes, not a ticking clock', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')
  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  // The relative timestamp is refreshed on a 15s interval. In a live region it
  // re-announced "Saved 4m ago" forever and buried the transitions that carry
  // meaning, so only the state word is announced now.
  const region = page.locator('.save-indicator [role="status"]')
  await expect(region).toHaveText(/Draft saved|Saving draft|Draft not saved/)
  await expect(region).not.toContainText('ago')

  const timestamp = page.locator('.save-indicator [aria-hidden="true"]')
  await expect(timestamp).toContainText(/Saved|Saving/)
})

test('the skip link resolves on both routes', async ({ page }) => {
  await page.goto('/builder')
  await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main-content')
  expect(await page.evaluate(() => !!document.querySelector('#main-content'))).toBe(true)

  // The embed route renders its own <main>, and third parties embed that route
  // on their own pages. A skip link pointing at nothing is the one bypass
  // mechanism those visitors have.
  await page.addInitScript((resume) => {
    sessionStorage.setItem('cvembed:draft', JSON.stringify(resume))
  }, { ...LONG_RESUME, basics: { ...LONG_RESUME.basics, name: 'Embedded Person' } })
  await page.goto('/embed/portable#data=' + Buffer.from(JSON.stringify({
    ...LONG_RESUME,
    basics: { ...LONG_RESUME.basics, name: 'Embedded Person', summary: 'Short summary.' },
  })).toString('base64url'))
  await expect(page.locator('.embed-host')).toBeVisible()
  expect(await page.evaluate(() => !!document.querySelector('#main-content'))).toBe(true)
})

test('a malformed accent colour is ignored rather than written into the page', async ({ page }) => {
  const resume = {
    ...LONG_RESUME,
    basics: { ...LONG_RESUME.basics, name: 'Colour Person', summary: 'Short summary.' },
  }
  const data = Buffer.from(JSON.stringify(resume)).toString('base64url')
  const heading = page.locator('.resume-template h1')

  // The embed takes this from its own query string and writes it to the
  // --primary custom property. Anything that is not a plain hex colour has no
  // business there, so it falls back to the document's own accent.
  await page.goto(`/embed/portable?primaryColor=red#data=${data}`)
  await expect(page.locator('.embed-host')).toBeVisible()
  await expect(heading).toHaveCSS('color', 'rgb(17, 17, 17)')

  // A real hex colour is honoured, so the check above is the guard working
  // rather than the parameter being ignored.
  await page.goto(`/embed/portable?primaryColor=%233b5bdb#data=${data}`)
  await expect(heading).toHaveCSS('color', 'rgb(59, 91, 219)')

  // The same rule applies to the bridge, where a host is the untrusted party.
  await page.goto('/builder')
  await page.evaluate(() => { document.getElementById('root')!.innerHTML = '<div id="sdk-target"></div>' })
  await page.addScriptTag({ url: new URL('/sdk.js', page.url()).toString() })
  await page.evaluate((data) => {
    const w = window as unknown as { CVEmbed: { render: (config: unknown) => { send: (c: string, p: unknown) => void } } }
    w.CVEmbed.render({
      target: '#sdk-target',
      baseUrl: location.origin,
      resumeData: JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)))),
      height: 800,
    }).send('setOptions', { primaryColor: 'red' })
  }, data)
  await expect(page.frameLocator('#sdk-target iframe').locator('.resume-template h1').first()).toHaveCSS('color', 'rgb(17, 17, 17)')
})

test('unknown routes explain how to recover', async ({ page }) => {
  await page.goto('/not-a-real-route')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open CV Builder' })).toBeVisible()
})
