import { chromium } from 'playwright'

/**
 * User-facing latency baseline for the production build.
 *
 * Measures what a person waits for, not internal counters. Run against
 * `npm run preview`:
 *
 *   node scripts/measure.mjs http://localhost:4173
 *
 * Prints a table. It is a measurement, not a pass/fail gate; the recorded
 * numbers live in docs/PERFORMANCE.md.
 */

const base = process.argv[2] ?? 'http://localhost:4173'
const ms = (value) => `${value.toFixed(0)} ms`

const LARGE_RESUME = {
  meta: { version: '1.0', template: 'minimal', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', documentOptions: {} },
  basics: {
    name: 'Benchmark User',
    headline: 'Principal Engineer',
    email: 'bench@example.com',
    phone: '+1 555 0100',
    location: 'Berlin',
    summary: 'Platform engineer focused on reliability and measurable delivery.',
    links: [{ label: 'GitHub', url: 'https://github.com/example' }],
  },
  education: Array.from({ length: 4 }, (_, i) => ({
    institution: `University ${i}`, degree: 'BS', field: 'Computer Science',
    cgpa: '', startDate: '2012', endDate: '2016', location: 'Berlin',
  })),
  experience: Array.from({ length: 6 }, (_, i) => ({
    company: `Company ${i}`, role: 'Engineer', location: 'Remote',
    startDate: '2016', endDate: '2024',
    bullets: Array.from({ length: 4 }, (_, j) => `Delivered outcome ${i}-${j} with a measurable reduction in cycle time across the platform team.`),
  })),
  projects: Array.from({ length: 5 }, (_, i) => ({
    title: `Project ${i}`, projectLink: 'https://example.com/p', repoLink: '',
    techStack: ['TypeScript', 'React'], startDate: '2020', endDate: '2021',
    bullets: Array.from({ length: 3 }, (_, j) => `Project outcome ${i}-${j} with measurable impact.`),
  })),
  skills: { languages: ['TypeScript', 'Go', 'Python'], frameworks: ['React'], tools: ['Postgres'], other: [] },
  certifications: [], accomplishments: [], activities: [], volunteering: [], publications: [],
}

const browser = await chromium.launch()
const results = {}

// --- Builder first visit and interaction readiness -------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const requests = []
  page.on('request', (r) => requests.push(r.url()))

  await page.goto(base, { waitUntil: 'domcontentloaded' })
  const dcl = await page.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd))
  const t0 = Date.now()
  await page.getByText('Resume Readiness').waitFor()
  results['builder first paint to interactive'] = Date.now() - t0
  results['builder DOMContentLoaded'] = dcl
  results['builder PDF chunk requests on first visit (want 0, count)'] = requests.filter((u) => u.includes('pdfRenderer')).length

  // Time to first keystroke reflected in the preview.
  const name = page.locator('input[name="name"]')
  await name.click()
  const t1 = Date.now()
  await name.pressSequentially('B', { delay: 0 })
  await page.locator('.resume-template').first().getByText('B').first().waitFor()
  results['builder keystroke to preview'] = Date.now() - t1

  // Time to open the export menu, which is the first thing that can pull the
  // PDF renderer.
  const t2 = Date.now()
  await page.locator('.tool-btn[title="Export resume"]').click()
  await page.locator('.export-dropdown').waitFor({ state: 'visible' })
  results['builder export menu open'] = Date.now() - t2
  await ctx.close()
}

// --- Large resume editing ---------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript((resume) => {
    localStorage.setItem('cvembed:draft', JSON.stringify(resume))
  }, LARGE_RESUME)
  const t0 = Date.now()
  await page.goto(base)
  await page.locator('.resume-template').first().waitFor()
  results['large resume load to render'] = Date.now() - t0

  const field = page.locator('input[name="headline"]')
  await field.click()
  const t1 = Date.now()
  await field.pressSequentially('X', { delay: 0 })
  await page.locator('.resume-template').first().waitFor()
  results['large resume keystroke'] = Date.now() - t1

  // Reorder the largest section and wait for the document to repaint.
  await page.locator('.organize-sections-btn').click()
  const t2 = Date.now()
  await page.locator('.order-item', { hasText: 'Experience' }).locator('[title="Move up"]').click()
  await page.locator('.resume-template').first().waitFor()
  results['large resume reorder'] = Date.now() - t2
  await ctx.close()
}

// --- PDF export -------------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  await page.addInitScript((resume) => {
    localStorage.setItem('cvembed:draft', JSON.stringify(resume))
  }, LARGE_RESUME)
  await page.goto(base)
  await page.locator('.resume-template').first().waitFor()

  const measureExport = async (label, format, file) => {
    await page.locator('.tool-btn[title="Export resume"]').click()
    await page.locator('.export-dropdown').waitFor({ state: 'visible' })
    const t0 = Date.now()
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      page.locator('.export-dropdown').getByText(format, { exact: false }).first().click(),
    ])
    const elapsed = Date.now() - t0
    const saved = `test-results/measure-${file}`
    await download.saveAs(saved)
    const { size } = await (await import('node:fs/promises')).stat(saved)
    results[`${label} [${Math.round(size / 1024)} kB]`] = elapsed
    return saved
  }

  const pdf = await measureExport('PDF export, first (includes renderer load)', 'PDF', 'large.pdf')
  await measureExport('PDF export, second (renderer warm)', 'PDF', 'large.pdf')
  await measureExport('DOCX export', 'DOCX', 'large.docx')

  // The export is only fast if the content is actually in it. Section
  // headings are uppercased by the template, so compare case-insensitively.
  const { execFileSync } = await import('node:child_process')
  try {
    const text = (execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' })).toLowerCase()
    results['PDF contains every rendered section'] = ['summary', 'education', 'experience', 'projects', 'skills']
      .every((heading) => text.includes(heading))
  } catch {
    results['PDF contains every rendered section'] = 'not checked, pdftotext unavailable'
  }
  await ctx.close()
}

// --- Embed iframe initialization and message processing --------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${base}/builder`)
  await page.evaluate(() => {
    const root = document.getElementById('root')
    if (root) root.innerHTML = '<div id="sdk-target"></div>'
  })
  await page.addScriptTag({ url: new URL('/sdk.js', base).toString() })

  const timings = await page.evaluate(async (resume) => {
    const out = {}
    let readyAt = 0
    const started = performance.now()
    const heights = []

    const instance = window.CVEmbed.render({
      target: '#sdk-target',
      baseUrl: location.origin,
      resumeData: resume,
      height: 800,
      events: {
        onReady: () => { readyAt = performance.now() - started },
        onHeightChange: ({ height }) => heights.push({ at: performance.now() - started, height }),
      },
    })

    await new Promise((resolve) => {
      const check = () => {
        if (readyAt > 0 || performance.now() - started > 20000) return resolve()
        setTimeout(check, 10)
      }
      check()
    })
    out['embed init to ready'] = readyAt
    out['embed first height message'] = heights[0]?.at ?? 0
    out['embed height messages (count)'] = heights.length
    out['embed instance ready flag'] = instance.isReady()
    return out
  }, LARGE_RESUME)

  Object.assign(results, timings)
  await ctx.close()
}

await browser.close()

console.log('\nCV-Embed latency baseline')
console.log(`target: ${base}\n`)
for (const [label, value] of Object.entries(results)) {
  const isLatency = !label.includes('count') && !label.includes('flag') && !label.includes('contains')
  const shown = isLatency && typeof value === 'number' ? ms(value) : String(value)
  console.log(`  ${label.padEnd(52)} ${shown}`)
}
console.log('')
