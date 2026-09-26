import { test, expect } from '@playwright/test'

test('embed panel: opens, shows friendly snippets, live preview works', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only flow')

  await page.goto('/builder')
  await expect(page.getByText('Resume Readiness')).toBeVisible()

  // Open the embed panel via the header Embed button.
  await page.locator('.header-embed-btn').click()
  const strip = page.locator('.embed-strip')
  await expect(strip).toBeVisible()

  // Friendly copy present.
  await expect(strip.getByText("Your resume is ready to embed")).toBeVisible()
  await expect(strip.locator('.embed-preset-select')).toHaveValue('placement')

  // Shareable link points at /embed/portable with data.
  const shareLink = strip.locator('a[aria-label="Open embed URL"]')
  await expect(shareLink).toBeVisible()
  const href = await shareLink.getAttribute('href')
  expect(href).toContain('/embed/portable?')
  expect(href).toContain('#data=')
  expect(href).not.toContain('?data=')

  // Snippet cards use friendly labels.
  await expect(strip.getByText('Website / portal')).toBeVisible()
  await expect(strip.getByText('React app')).toBeVisible()
  await expect(strip.getByText('Advanced (auto-height + events)')).toBeVisible()

  // The generated SDK snippet carries the same resume and executes as pasted.
  const sdkCode = await strip.locator('.embed-snippet-card', { hasText: 'Advanced' }).locator('.embed-snippet-code').textContent()
  expect(sdkCode).toContain('resumeData:')
  expect(sdkCode).not.toContain('resumeId:')

  const sdkHost = await page.context().newPage()
  await sdkHost.goto('/builder')
  await sdkHost.evaluate(() => {
    document.getElementById('root')!.innerHTML = '<div id="resume-container"></div>'
  })
  await sdkHost.addScriptTag({ url: new URL('/sdk.js?v=2', sdkHost.url()).toString() })
  const inlineSdk = sdkCode!.match(/<script>\n([\s\S]*?)<\/script>/)?.[1]
  expect(inlineSdk).toBeTruthy()
  await sdkHost.evaluate((code) => window.eval(code), inlineSdk!)
  await expect(sdkHost.frameLocator('iframe').locator('.resume-template')).toBeVisible({ timeout: 15_000 })
  await sdkHost.close()

  // Live preview iframe renders the actual resume (open the collapsed <details> first).
  await strip.locator('.embed-preview-details summary').click()
  const frame = page.frameLocator('.embed-preview-frame')
  await expect(frame.locator('.resume-template')).toBeVisible({ timeout: 15_000 })

  // Preset switch updates height + download flag.
  await strip.locator('.embed-preset-select').selectOption('portfolio')
  await expect(strip.locator('.embed-height-input')).toHaveValue('1200')
})
