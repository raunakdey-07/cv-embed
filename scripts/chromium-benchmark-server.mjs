import { createServer } from 'node:http'
import { chromium } from 'playwright'

const PORT = Number(process.env.PDF_BENCH_PORT || '8787')
const PUBLIC_BASE_URL = (process.env.PDF_BENCH_PUBLIC_BASE_URL || 'http://127.0.0.1:4174').replace(/\/+$/, '')

function encodeResumeData(resume) {
  const json = JSON.stringify(resume)
  const base64 = Buffer.from(json, 'utf-8').toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function percentile(values, pct) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1))
  return sorted[index]
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasArrayContent(items = []) {
  return items.some((item) => {
    if (!item || typeof item !== 'object') return false
    return Object.values(item).some((value) => {
      if (typeof value === 'string') return hasText(value)
      if (Array.isArray(value)) return value.some((entry) => typeof entry === 'string' ? hasText(entry) : !!entry)
      return false
    })
  })
}

function expectedHeadingCount(resume) {
  const options = resume?.meta?.documentOptions
  if (!options?.showSections) return 0

  let count = 0
  if (options.showSections.summary && hasText(resume?.basics?.summary)) count += 1
  if (options.showSections.education && hasArrayContent(resume?.education)) count += 1
  if (options.showSections.experience && hasArrayContent(resume?.experience)) count += 1
  if (options.showSections.projects && hasArrayContent(resume?.projects)) count += 1

  const skills = resume?.skills || {}
  const hasSkills = [skills.languages, skills.frameworks, skills.tools, skills.other]
    .flat()
    .some((value) => hasText(value || ''))
  if (options.showSections.skills && hasSkills) count += 1

  if (options.showSections.certifications && hasArrayContent(resume?.certifications)) count += 1
  if (options.showSections.accomplishments && hasArrayContent(resume?.accomplishments)) count += 1
  if (options.showSections.activities && hasArrayContent(resume?.activities)) count += 1
  if (options.showSections.volunteering && hasArrayContent(resume?.volunteering)) count += 1
  if (options.showSections.publications && hasArrayContent(resume?.publications)) count += 1

  return count
}

async function benchmarkChromium(browser, resume, iterations) {
  const runs = Math.max(1, Math.min(12, Number(iterations) || 3))
  const samplesMs = []
  const sizesKb = []
  const coveragePct = []
  const expected = expectedHeadingCount(resume)

  for (let index = 0; index < runs; index += 1) {
    const page = await browser.newPage()
    try {
      const data = encodeResumeData(resume)
      const targetUrl = `${PUBLIC_BASE_URL}/embed/portable?data=${data}&mode=preview&showDownload=0`

      const start = performance.now()
      await page.goto(targetUrl, { waitUntil: 'networkidle' })
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
      const end = performance.now()

      samplesMs.push(Math.max(0, Math.round(end - start)))
      sizesKb.push(pdfBuffer.byteLength / 1024)

      const renderedHeadingCount = await page.locator('.resume-template h2').count()
      if (expected === 0) {
        coveragePct.push(100)
      } else {
        coveragePct.push(Math.round((renderedHeadingCount / expected) * 100))
      }
    } finally {
      await page.close()
    }
  }

  const totalMs = samplesMs.reduce((sum, value) => sum + value, 0)
  const totalKb = sizesKb.reduce((sum, value) => sum + value, 0)
  const totalCoverage = coveragePct.reduce((sum, value) => sum + value, 0)

  return {
    engine: 'chromium',
    iterations: runs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    avgMs: Math.round(totalMs / runs),
    p50Ms: Math.round(percentile(samplesMs, 50)),
    p95Ms: Math.round(percentile(samplesMs, 95)),
    avgSizeKb: totalKb / runs,
    avgHeadingCoveragePct: totalCoverage / runs,
    samplesMs,
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 2_000_000) {
        reject(new Error('Payload too large'))
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

const browser = await chromium.launch({ headless: true })

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, engine: 'chromium' }))
    return
  }

  if (req.method === 'POST' && req.url === '/api/pdf-benchmark') {
    try {
      const body = await readJsonBody(req)
      const resume = body?.resume
      if (!resume || typeof resume !== 'object') {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing resume payload' }))
        return
      }

      const stats = await benchmarkChromium(browser, resume, body?.iterations)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(stats))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: String(error) }))
    }
    return
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`[pdf-bench] chromium benchmark server listening on :${PORT}`)
  console.log(`[pdf-bench] rendering from ${PUBLIC_BASE_URL}`)
})

const shutdown = async () => {
  await browser.close()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
