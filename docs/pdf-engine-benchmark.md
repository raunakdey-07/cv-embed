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

In dev mode, open the builder and click the lightning icon in the preview toolbar.

- The benchmark runs 4 local iterations by default.
- A summary toast appears: `PDF bench p50 ...`.
- Full stats are logged to console in dev mode.

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
