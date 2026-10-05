# CV-Embed performance baseline

Measured against the production build on `vite preview`, Chromium 146 headless,
on an 8-core Linux container. Reproduce with:

```bash
npm run build
npm run preview -- --port 4173 &
npm run measure -- http://localhost:4173
```

These are numbers, not targets. Absolute values move with hardware; the point is
to have a before and after rather than a claim that something is "fast".

## Bundle sizes

| Chunk | Raw | Gzip | When it loads |
| --- | --- | --- | --- |
| `index` (app entry) | 168.88 kB | 42.58 kB | always |
| `react-vendor` | 231.90 kB | 74.39 kB | always |
| `index.css` | 35.09 kB | 6.40 kB | always |
| `EmbedPage` | 9.37 kB | 3.66 kB | `/embed/:id` only |
| `docxRenderer` | 351.01 kB | 101.17 kB | DOCX export only |
| `pdfRenderer` | 1,582.04 kB | 529.35 kB | PDF export only |
| `public/sdk.js` | 158.78 kB | 28.45 kB | host pages that embed |

Same-origin first visit totals about 123 kB across 8 requests. Web fonts add
about 100 kB, which the Timing API reports as zero because the font host sends
no `Timing-Allow-Origin` header.

`public/sdk.js` grew from 8.5 kB when the bridge started validating every
message with Zod schemas. That is the cost of schema validation at a
cross-origin boundary, paid once per host page that embeds. The schemas for the
embed side live in the `EmbedPage` chunk, so the builder does not carry them.

## Latency

| Measurement | Value |
| --- | --- |
| Builder first paint to interactive | 84 ms |
| Builder DOMContentLoaded | 618 ms |
| Builder keystroke reflected in preview | 69 ms |
| Builder export menu opens | 100 ms |
| Large resume load to first render | 636 ms |
| Large resume keystroke | 57 ms |
| Large resume section reorder | 116 ms |
| PDF export, first (includes renderer load) | 1,224 ms |
| PDF export, second (renderer already loaded) | 275 ms |
| DOCX export | 321 ms |
| Embed `render()` to `ready` | 439 ms |
| Embed `render()` to first height message | 444 ms |

The "large resume" fixture is 4 education entries, 6 roles with 4 bullets each,
5 projects, and 13 skills. Typing costs the same there as on an empty CV, so the
editor is not re-rendering more than it has to.

## Why the PDF numbers look the way they do

The 1.2 s first export is dominated by fetching and evaluating a 1.58 MB chunk
that the first visit never touches. The 275 ms warm export is the actual work.
This is the deliberate trade: the builder pays nothing until someone asks for a
PDF. Verified on every first visit:

- 0 requests to `pdfRenderer` on a blank load
- the build fails if the production entry imports the PDF renderer eagerly
  (`scripts/check-production-build.mjs`)

## Bridge message volume

A large resume produces 2 height messages over the life of an embed: one on
first paint, one after fonts settle. The embed coalesces height publishing into
one message per animation frame and skips the frame when one is already queued,
so scrolling a tall resume does not flood the host.

## What was deliberately not changed

- **Font loading.** The `@import` became a `<link>` with `preconnect`, which
  removed a serial dependency: the font stylesheet request now starts in
  parallel with the app CSS rather than after it. Timing on localhost is within
  noise; the win is structural and scales with stylesheet size.
- **No virtualisation.** The largest realistic resume is a few hundred DOM
  nodes. Virtualising it would add complexity for no measured gain.
- **No memoisation of the preview.** Keystroke to preview is 57-69 ms. Splitting
  the render path would cost more in complexity than it returns.
