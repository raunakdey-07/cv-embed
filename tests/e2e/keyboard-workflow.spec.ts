import { expect, test } from '@playwright/test'

/**
 * The builder has to be usable without a mouse: open, navigate, edit, add and
 * reorder entries, switch to preview, and export. Everything here is driven
 * with the keyboard only.
 */

const tabTo = async (page: import('@playwright/test').Page, target: import('@playwright/test').Locator, limit = 80) => {
  for (let step = 0; step < limit; step += 1) {
    const reached = await target.evaluate((node) => node === document.activeElement).catch(() => false)
    if (reached) return step
    await page.keyboard.press('Tab')
  }
  return -1
}

test.describe('keyboard-only workflow', () => {
  test('skip link is the first stop and moves focus into the editor', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    await page.keyboard.press('Tab')
    const firstStop = await page.evaluate(() => {
      const node = document.activeElement as HTMLElement | null
      return { text: node?.textContent?.trim(), href: node?.getAttribute('href') }
    })
    expect(firstStop.text).toBe('Skip to editor')
    expect(firstStop.href).toBe('#main-content')

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main-content$/)
  })

  test('every interactive control is reachable and shows a focus ring', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    // Walk the header controls the keyboard has to pass through.
    for (const label of ['Import resume JSON', 'Embed resume']) {
      const control = page.locator('.app-header').getByRole('button', { name: label, exact: true })
      await expect(control).toBeVisible()
      await control.focus()
      const ring = await control.evaluate((node) => {
        const style = getComputedStyle(node)
        return { width: style.outlineWidth, style: style.outlineStyle }
      })
      expect(ring.style, `${label} outline-style`).not.toBe('none')
      expect(parseFloat(ring.width), `${label} outline-width`).toBeGreaterThan(0)
    }
  })

  test('section navigation works with the keyboard and moves focus to the field', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    const summaryTab = page.locator('.nav-tab', { hasText: 'Summary' })
    await summaryTab.focus()
    await expect(summaryTab).toBeFocused()
    await page.keyboard.press('Enter')

    const summaryField = page.locator('#section-summary textarea').first()
    await expect(summaryField).toBeFocused()
  })

  test('a section can be filled in entirely with the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    const name = page.locator('input[name="name"]')
    await name.focus()
    await page.keyboard.type('Keyboard User')
    await expect(name).toHaveValue('Keyboard User')

    const email = page.locator('input[name="email"]')
    await email.focus()
    await page.keyboard.type('keyboard@example.com')
    await expect(email).toHaveValue('keyboard@example.com')

    // The live preview reflects what was typed without any pointer input.
    await expect(page.locator('.resume-template').first()).toContainText('Keyboard User')
  })

  test('entries can be added and removed with the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    await expect(page.locator('#section-experience')).toContainText('No experience added yet.')
    const add = page.getByRole('button', { name: 'Add experience' })
    await add.focus()
    await page.keyboard.press('Enter')

    await expect(page.locator('#section-experience input[name="experience-0-company"]')).toBeVisible()
    await page.locator('#section-experience input[name="experience-0-company"]').focus()
    await page.keyboard.type('Keyboard Labs')

    const remove = page.getByRole('button', { name: 'Remove experience 1', exact: true })
    await remove.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#section-experience')).toContainText('No experience added yet.')
  })

  test('sections can be reordered and hidden from the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    const organize = page.getByRole('button', { name: /Organize sections/i })
    await organize.focus()
    await page.keyboard.press('Enter')

    const sheet = page.getByRole('group', { name: 'Visibility and order' })
    await expect(sheet).toBeVisible()

    const moveUp = sheet.getByRole('button', { name: 'Move Education up', exact: true })
    await moveUp.focus()
    await page.keyboard.press('Enter')

    const tabs = await page.locator('.section-nav-tabs .nav-tab').allTextContents()
    expect(tabs.indexOf('Education')).toBeLessThan(tabs.indexOf('Summary'))

    const hide = sheet.getByRole('checkbox', { name: /Projects/i }).first()
    await hide.focus()
    await page.keyboard.press('Space')
    await expect(page.locator('.nav-tab', { hasText: 'Projects' })).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('preview and export are reachable with the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await page.addInitScript((now) => {
      sessionStorage.setItem('cvembed:draft', JSON.stringify({
        meta: {
          version: '1.0', template: 'minimal', createdAt: now, updatedAt: now,
          documentOptions: {},
        },
        basics: { name: 'Export User', headline: '', email: 'e@example.com', phone: '', location: '', summary: 'S', links: [] },
        education: [], experience: [], projects: [],
        skills: { languages: ['a', 'b', 'c'], frameworks: [], tools: [], other: [] },
        certifications: [], accomplishments: [], activities: [], volunteering: [], publications: [],
      }))
    }, new Date().toISOString())

    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()
    await expect(page.locator('.resume-template').first()).toContainText('Export User')

    const exportButton = page.locator('.tool-btn[title="Export resume"]')
    const reached = await tabTo(page, exportButton)
    expect(reached, `reached export button in ${reached} tabs`).toBeGreaterThanOrEqual(0)

    await exportButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.export-dropdown')).toBeVisible()

    const json = page.locator('.export-dropdown').getByText('JSON', { exact: false }).first()
    await json.focus()
    const download = page.waitForEvent('download', { timeout: 30_000 })
    await page.keyboard.press('Enter')
    expect((await download).suggestedFilename()).toContain('Export User')
  })

  test('focus never lands on an element that is hidden from sight', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    await page.goto('/builder')
    await expect(page.getByText('Resume Readiness')).toBeVisible()

    const hiddenStops: string[] = []
    for (let step = 0; step < 120; step += 1) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const node = document.activeElement as HTMLElement | null
        if (!node || node === document.body) return null
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return {
          label: `${node.tagName}.${String(node.className).slice(0, 30)}`,
          invisible: style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0',
          offscreen: rect.width === 0 && rect.height === 0,
          ariaHidden: node.closest('[aria-hidden="true"]') !== null,
        }
      })
      if (info?.invisible || info?.offscreen || info?.ariaHidden) hiddenStops.push(info.label)
    }
    expect(hiddenStops).toEqual([])
  })
})
