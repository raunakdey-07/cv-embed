import { expect, test } from '@playwright/test'

/**
 * The published example is documentation, so it is treated as a test: if the
 * documented integration stops working, this fails.
 */
test.describe('external host example', () => {
  test('completes the full documented lifecycle', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/example-host.html')

    // 1. Initialization and handshake.
    await expect(page.locator('#status')).toContainText('Ready', { timeout: 20_000 })
    await expect(page.frameLocator('#resume iframe').locator('.resume-template')).toBeVisible({ timeout: 20_000 })
    await expect(page.frameLocator('#resume iframe').locator('.resume-template')).toContainText('Ada Lovelace')

    // 2. Height changes reach the host and resize the frame.
    await expect.poll(async () => page.locator('#log li').filter({ hasText: 'heightChange' }).count()).toBeGreaterThan(0)
    const height = Number(await page.locator('#resume iframe').getAttribute('height'))
    expect(height).toBeGreaterThan(0)

    // 3. Validation is published.
    await expect.poll(async () => page.locator('#log li').filter({ hasText: 'validationChange' }).count()).toBeGreaterThan(0)

    // 4. Section focus scrolls and focuses inside the frame.
    await page.getByRole('button', { name: 'Focus Experience' }).click()
    await expect.poll(async () => page.locator('#log li').filter({ hasText: 'sent focusSection' }).count()).toBeGreaterThan(0)

    // 5. Resume replacement is accepted and re-rendered.
    await page.getByRole('button', { name: 'Replace resume' }).click()
    await expect(page.frameLocator('#resume iframe').locator('.resume-template')).toContainText('Ada King-Noel')

    // 6. Options are applied.
    await page.getByRole('button', { name: 'Hide download' }).click()
    await expect(page.frameLocator('#resume iframe').locator('a.link-button')).toHaveCount(0)

    // 7. Export is requested and answered.
    await page.getByRole('button', { name: 'Request export' }).click()
    await expect.poll(async () => page.locator('#log li').filter({ hasText: /^export/ }).count()).toBeGreaterThan(0)

    // 8. Re-sync restates state without breaking.
    await page.getByRole('button', { name: 'Re-sync' }).click()
    await expect.poll(async () => page.locator('#log li').filter({ hasText: 'ready' }).count()).toBeGreaterThan(1)

    expect(errors).toEqual([])
  })

  test('the example declares no console errors on load', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only flow')
    const problems: string[] = []
    page.on('pageerror', (error) => problems.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text())
    })

    await page.goto('/example-host.html')
    await expect(page.locator('#status')).toContainText('Ready', { timeout: 20_000 })
    expect(problems).toEqual([])
  })
})
