# CV-Embed — Build, Export, and Embed ATS-Friendly Resumes

CV-Embed is a fast resume builder built with React + TypeScript. It gives you a focused editing experience, live preview, PDF/DOCX export, and embed-ready sharing for portfolios, placement portals, and personal sites.

## Features

- **Resume Builder UI**: Structured sections for basics, education, experience, projects, skills, certifications, accomplishments, activities, volunteering, and publications. New resumes start with a basic set (Summary, Education, Experience, Projects, Skills); the rest are opt-in.
- **Live Preview**: Real-time visual preview while editing with typography, density, and section-order controls.
- **Formatting Options**: Accent color, font family, font size, line height, heading style, bullet style, date style, and density — applied consistently across the live preview **and** every export format (PDF, DOCX).
- **Section Visibility & Order**: Toggle sections on/off and reorder them from the nav's organize sheet or the Format panel; the editing form, nav, preview, and all exports stay in sync.
- **Export Options**: Download polished resumes as **PDF**, **DOCX**, and raw **JSON**.
- **Embed Toolkit**: Generate a portable embed URL, iframe snippet, and SDK script integration block.
- **SDK v2 Bridge**: `postMessage` event API (`ready`, `heightChange`, `validationChange`, `sectionFocus`, `export`) with callback hooks.
- **Auto-height Embeds**: Resize-aware iframe integration for portal layouts.
- **Integration Pack Copy**: One-click copy for URL + iframe + React + SDK + event contract.
- **Host Controls**: Guided mode, debug mode, locked template, read-only sections, download/import toggles.
- **Validation & Scoring**: Inline error/warning checks with a resume quality score indicator.
- **Draft Persistence**: Saves progress in browser storage so your data survives refreshes.
- **Portable Data**: Import/export normalized resume JSON for backup and migration.
- **Performance**: PDF engine (~1.5 MB) is lazy-loaded — on mobile only when you actually export or open the embed panel.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Routing**: `react-router-dom`
- **PDF Export**: `@react-pdf/renderer`
- **DOCX Export**: `docx`
- **Validation**: `zod`
- **Linting**: ESLint

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/raunakdey-07/cv-embed.git
   cd cv-embed
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in development:**
   ```bash
   npm run dev
   ```

## Available Scripts

```bash
npm run dev      # Start dev server
npm run lint     # Run ESLint
npm run build    # Type-check + production build
npm run preview  # Preview production build locally
npm run test:unit # Run unit tests
npm run test:e2e  # Run Playwright desktop/mobile interaction tests
npm run test      # Run unit + e2e suite
npm run bench:server # Run local Chromium benchmark server
```

## Routes

- `/` — Main resume builder
- `/builder` — Builder alias for shared links
- `/embed/:resumeId` — Embedded resume view
- `/embed/portable?data=...` — Encoded portable embed payload

## Embed Example (SDK v2)

```html
<script src="https://your-domain.com/sdk.js?v=2"></script>
<div id="resume-container"></div>
<script>
   const embed = CVEmbed.render({
    target: '#resume-container',
    baseUrl: 'https://your-domain.com',
    resumeData: {/* normalized resume JSON */},
      options: {
         showDownload: false,
         autoHeight: true,
         mode: 'guided',
         eventTargetOrigin: window.location.origin
      },
      events: {
         onReady: (payload) => console.log('ready', payload),
         onHeightChange: ({ height }) => console.log('height', height),
         onValidationChange: (payload) => console.log('validation', payload),
         onSectionFocus: (payload) => console.log('section', payload),
         onExport: (payload) => console.log('export', payload)
      }
  });

   // Optional lifecycle helpers
   // embed.update({ options: { mode: 'preview' } });
   // embed.destroy();
</script>
```

## SDK v2 Options

- `options.autoHeight` (default `true`): auto-resize iframe based on embed content.
- `options.mode`: `preview | guided | edit`.
- `options.debug`: render integration diagnostics inside embed.
- `options.readOnlySections`: pass host policy metadata.
- `options.lockedTemplate`: lock render template to `minimal` or `compact`.
- `options.disableImport`: pass host policy metadata.
- `options.disableDownload`: force hide builder CTA.
- `options.eventTargetOrigin`: explicit `postMessage` target origin.
- `theme.fontScale`: scale resume typography (0.9 - 1.25).
- `theme.radius`: host border radius token (4 - 14).

## Event Payload Contract

The iframe posts messages shaped like:

```json
{
   "source": "cv-embed",
   "version": "2",
   "event": "ready|heightChange|validationChange|sectionFocus|export",
   "embedId": "cvembed_xxxxxxxx",
   "payload": {}
}
```

`validationChange` includes a machine-readable `issues` array with `severity`, `section`, `code`, and `message`.

## SDK Playground

- Open `/sdk-playground.html` to test SDK v2 integrations interactively.
- It supports render/update/destroy, live event logs, mode/debug toggles, and JSON payload editing.

## Formatting Options

All options live in the Format panel (and section visibility/order also in the nav's organize sheet). Every change applies immediately to the live preview and to PDF/DOCX exports:

| Option | Choices | Notes |
| --- | --- | --- |
| Accent Color | Any hex via color picker | Heading + link colors in preview/PDF/DOCX |
| Font | Bricolage Grotesque, Syne, Azeret Mono, Instrument Serif, Helvetica, Times | Web fonts in preview; closest system font in PDF/DOCX |
| Size | Small / Normal / Large | Body text scale in all outputs |
| Line Height | Tight / Normal / Relaxed | All outputs |
| Headings | Uppercase + Rule / Bold Titles / Minimal | All outputs |
| Bullets | Dot / Dash | All outputs |
| Dates | `Jun 2024 - Aug 2025` / `Jun 2024–Aug 2025` | All outputs |
| Density | Comfortable / Compact / Relaxed | Spacing scale in preview/PDF; DOCX uses line-height equivalent |
| Link Display | Short label / Full URL | Header links in all outputs |
| Visibility & Order | Per-section toggle + ↑↓ reorder | Form, nav, preview, and exports share one source of truth |

## Testing & QA

```bash
npm run test:unit   # Vitest unit tests
npm run test:e2e    # Playwright tests across desktop-chromium and mobile-chromium
npm run test        # Both suites
```

E2E coverage includes builder QoL flows (readiness pill, mobile Edit/Preview toggle, tap-to-open popovers, organize-sheet visibility sync), PDF engine lazy loading per device class, and export menu behavior. CI runs lint, build, unit, and e2e on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

Manual checklists live in `docs/ux-qa-matrix.md`.

## Manual UX QA

- Use `docs/ux-qa-matrix.md` to verify the 12 high-impact QoL upgrades on desktop and mobile.
- It includes step-by-step scenarios, expected behavior, and a reusable QA log template.

## PDF Benchmarking

- Use `docs/pdf-engine-benchmark.md` to measure local PDF engine latency and output size.
- Benchmarks run programmatically via `benchmarkReactPdfEngine` in `src/pdf/pdfRenderer.tsx`; the optional Chromium comparison uses `npm run bench:server`.

## Project Structure

```text
cv-embed/
├── .github/workflows/      # CI (lint, build, unit, e2e)
├── docs/                   # QA matrix + PDF benchmark guide
├── public/                 # sdk.js, playground, headers/redirects
├── scripts/                # Chromium benchmark server
├── sdk/                    # SDK TypeScript source
├── src/
│   ├── app/                # Builder + embed pages
│   ├── components/
│   │   ├── sections/       # Editable resume sections
│   │   ├── templates/      # Resume templates/renderers
│   │   └── ui/             # Icons + shared UI (SectionNav)
│   ├── docx/               # DOCX renderer
│   ├── pdf/                # PDF renderer (lazy-loaded)
│   ├── lib/                # Utils, content checks, scoring, storage
│   ├── schema/             # Zod schema + validators
│   └── types/              # Resume type definitions
├── tests/e2e/              # Playwright specs
├── package.json
└── README.md
```

## Deployment (Vercel)

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

If deployed from a monorepo, set root directory to `cv-embed`.

## License

MIT
