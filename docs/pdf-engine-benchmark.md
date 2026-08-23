# PDF Engine Benchmarking

This project keeps live preview HTML-first for typing performance, and benchmarks PDF generation separately.

## Goals

- Quantify PDF render latency (`min`, `avg`, `p50`, `p95`, `max`).
- Track output size (`avgSizeKb`) for regression monitoring.
- Track a lightweight fidelity signal (`avgHeadingCoveragePct`) to catch missing rendered sections.
- Build a baseline before introducing alternate engines (for example backend Chromium).

## Current Engine

- Engine: `react-pdf`
- Benchmark API: `benchmarkReactPdfEngine` in `src/pdf/pdfRenderer.tsx`

## How To Run

Benchmarks are run programmatically via `benchmarkReactPdfEngine` in `src/pdf/pdfRenderer.tsx` (there is no in-app benchmark button):

1. Start the Chromium benchmark server: `npm run bench:server`
2. Call the local engine from a dev console or script:
   ```js
   const { benchmarkReactPdfEngine } = await import('/src/pdf/pdfRenderer.tsx')
   const stats = await benchmarkReactPdfEngine(resume, 4)
   console.table(stats)
   ```
- A remote comparison runs through the same endpoint contract below.

### Optional Remote Comparison (Chromium)

Set `VITE_PDF_BENCHMARK_ENDPOINT` to compare local `react-pdf` against a remote benchmark endpoint.

Example `.env.local`:

```bash
VITE_PDF_BENCHMARK_ENDPOINT=http://127.0.0.1:8787/api/pdf-benchmark
```

Local end-to-end setup:

1. Start app dev server:
  - `npm run dev -- --host 127.0.0.1 --port 4174`
2. In another terminal, start Chromium benchmark server:
  - `PDF_BENCH_PUBLIC_BASE_URL=http://127.0.0.1:4174 npm run bench:server`
3. Keep `VITE_PDF_BENCHMARK_ENDPOINT` set and invoke `benchmarkRemotePdfEngine(resume, endpoint)` with the same resume.

Server file:

- `scripts/chromium-benchmark-server.mjs`
- Health check: `GET /health`
- Benchmark endpoint: `POST /api/pdf-benchmark`

Expected endpoint contract:

```json
{
  "engine": "chromium",
  "iterations": 4,
  "minMs": 640,
  "maxMs": 1012,
  "avgMs": 801,
  "p50Ms": 780,
  "p95Ms": 1003,
  "avgSizeKb": 228,
  "avgHeadingCoveragePct": 100,
  "samplesMs": [760, 790, 1003, 650]
}
```

## Output Shape

```ts
interface PdfBenchmarkStats {
  engine: 'react-pdf'
  iterations: number
  minMs: number
  maxMs: number
  avgMs: number
  p50Ms: number
  p95Ms: number
  avgSizeKb: number
  avgHeadingCoveragePct: number
  samplesMs: number[]
}
```

## Next Phase (Overleaf-Level Direction)

- Add a backend Chromium benchmark endpoint and compare against `react-pdf` baseline.
- Keep HTML editing/preview local and immediate.
- Use benchmark deltas to choose default export engine for fidelity vs. speed.

## QA Automation

- Unit tests: `npm run test:unit`
- E2E desktop/mobile tests: `npm run test:e2e`
