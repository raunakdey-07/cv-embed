# CV-Embed — Build, Export, and Embed ATS-Friendly Resumes

CV-Embed is a resume builder built with React + TypeScript. Use it as a standalone
app at `/builder`, or embed a live resume in your own page with the SDK.

## Embedding in another application

Load the SDK from a script tag and render into any element. This is a real host
page, not a screenshot: it initializes, waits for `ready`, replaces the resume,
sends commands, and reacts to errors.

```html
<script src="https://your-domain.com/sdk.js"></script>
<div id="resume"></div>
<script>
  const embed = CVEmbed.render({
    target: '#resume',
    baseUrl: 'https://your-domain.com',
    resumeData: {/* a normalized CV-Embed document */},
    events: {
      onReady: ({ score }) => console.log('ready, score', score),
      onHeightChange: ({ height }) => console.log('height', height),
      onValidationChange: ({ issues }) => console.log('issues', issues.length),
      onExport: ({ action }) => console.log('export', action),
      onError: ({ code, message }) => console.warn(code, message),
    },
  });

  embed.send('setResume', { resume: nextDocument });
  embed.send('focusSection', { section: 'Experience' });
  embed.destroy();
</script>
```

- A complete runnable example: [`public/example-host.html`](public/example-host.html),
  served at `/example-host.html`.
- Full message contract, payload shapes, and version rules:
  [`docs/SDK_PROTOCOL.md`](docs/SDK_PROTOCOL.md).
- Interactive playground for debugging: `/sdk-playground.html`.

The iframe is a real cross-origin boundary. Messages are checked by window,
origin, embed id, protocol version, and payload schema on both sides. See
[What the bridge actually checks](docs/SDK_PROTOCOL.md#what-the-bridge-actually-checks)
for exactly what is enforced, including the limits.

## Features

- **Resume Builder UI**: Structured sections for basics, education, experience, projects, skills, certifications, accomplishments, activities, volunteering, and publications. New resumes start with a basic set (Summary, Education, Experience, Projects, Skills); the rest are opt-in.
- **Live Preview**: Real-time visual preview while editing with typography, density, and section-order controls.
- **Format Panel**: Accent, font, size, line-height, headings, bullets, dates, density, link display, template, header alignment — no visibility/order (those live in the organize sheet).
- **Organize Sheet**: Toggle sections (default basic 5 enabled) and reorder; changes sync instantly to form, nav, preview, and exports.
- **Section Visibility & Order**: Toggle sections on/off and reorder them from the nav's organize sheet or the Format panel; the editing form, nav, preview, and all exports stay in sync.
- **Export Options**: Download polished resumes as **PDF**, **DOCX**, and raw **JSON**. PDF export stops with a clear message when the built-in PDF fonts cannot represent the entered characters; DOCX remains Unicode-capable.
- **Mobile UX**: Lazy-loaded PDF engine, smooth edit↔preview pane transition, taller nav bar, format dropdown beside organize, and responsive embed panel.
- **Embed Toolkit**: Friendly snippets, live preview iframe, SDK v2, and user-friendly dropdown flow.
- **SDK v2 Bridge**: a two-way `postMessage` protocol. Events out (`ready`, `heightChange`, `validationChange`, `sectionFocus`, `export`, `error`), commands in (`syncState`, `setResume`, `focusSection`, `requestExport`, `setOptions`). Every message is schema-validated.
- **Auto-height Embeds**: Resize-aware iframe integration for portal layouts.
- **Integration Pack Copy**: One-click copy for URL + iframe + React + SDK + event contract.
- **Host Controls**: Guided mode, debug mode, locked template, read-only metadata, and builder-link visibility. See the SDK contract for current limits.
- **Validation & Scoring**: Visibility-aware error and warning checks with a resume quality score indicator.
- **Draft Persistence**: Saves progress in guarded local browser storage so your data survives refreshes and tab changes.
- **Portable Data**: Import/export normalized resume JSON for backup and migration. Portable links keep resume data in the URL fragment, where the browser does not send it in the HTTP request. Anyone with the link can still read the CV.
- **Performance**: PDF engine (~1.5 MB) loads only when export or embed tools request it.

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
- `/embed/portable?data=...` or `#data=...` — Portable embed payload. New links keep data in the fragment; legacy query links remain supported.

## Embed Example (SDK v2)

See [Embedding in another application](#embedding-in-another-application) above
for the shortest version, and [`docs/SDK_PROTOCOL.md`](docs/SDK_PROTOCOL.md) for
every field. The full option list:

```ts
const embed = CVEmbed.render({
  target: '#resume-container',        // selector or element, required
  baseUrl: 'https://your-domain.com', // origin serving /embed/:id
  resumeId: undefined,                // or resumeId, or one of resumeData
  resumeData: {/* normalized resume JSON */},
  width: '100%',
  height: 1100,                       // starting height; autoHeight takes over
  title: 'Resume of Ada Lovelace',    // iframe title, used by screen readers
  theme: {
    primaryColor: '#3b5bdb',
    density: 'normal',                // 'normal' | 'compact'
    fontScale: 1,                     // 0.9 - 1.25
    radius: 8,                        // 4 - 14
  },
  options: {
    autoHeight: true,
    mode: 'preview',                  // 'preview' | 'guided' | 'edit'
    showDownload: true,
    disableDownload: false,
    debug: false,
    lockedTemplate: undefined,        // 'minimal' | 'compact'
    readOnlySections: [],             // metadata only, not enforced
    disableImport: false,             // metadata only, not enforced
    eventTargetOrigin: window.location.origin,
  },
  events: { /* see below */ },
});

// Lifecycle
embed.isReady();                                   // has the frame handshaken?
embed.update({ resumeData: next });                // transactional: a bad value throws and changes nothing
embed.send('focusSection', { section: 'Projects' });
embed.on('onError', ({ code, message }) => {});    // register later
embed.off('onError');
embed.destroy();
```

## SDK v2 Options

- `baseUrl`: origin that serves the embed route. **Required unless `sdk.js` is loaded by a classic `<script>` tag.** The SDK captures its own origin at load time via `document.currentScript`, which is null when the file is bundled or evaluated. Without a resolvable origin the embed falls back to the host page origin and the frame loads a 404, so pass `baseUrl` explicitly whenever you load the SDK through a bundler.
- `options.autoHeight` (default `true`): auto-resize iframe based on embed content.
- `options.mode`: `preview | guided | edit`.
- `options.debug`: render integration diagnostics inside embed.
- `options.readOnlySections`: **metadata only, not enforced.** The embedded resume is always read-only because it renders a template with no editing surface. The value is reported in the `ready` payload so a host can read back what it requested. Do not use it as a security control.
- `options.lockedTemplate`: lock render template to `minimal` or `compact`.
- `options.disableImport`: **metadata only, not enforced.** The embed exposes no import control. Do not use it as a security control.
- `options.disableDownload`: force hide builder CTA.
- `options.eventTargetOrigin`: explicit `postMessage` target origin. The SDK defaults to the host page origin.
- `theme.fontScale`: scale resume typography (0.9 - 1.25).
- `theme.radius`: host border radius token (4 - 14).

## Versions

```js
CVEmbed.version          // SDK package version, e.g. "2.1.0"
CVEmbed.protocolVersion  // wire protocol version, currently "2"
```

A message carrying a different `version` is dropped. The embed additionally
answers a foreign-version command with an `error` event using code
`unsupported-protocol`, so a mismatched host finds out instead of going quiet.
Breaking changes bump the protocol version; non-breaking releases do not. What
counts as breaking is listed in the protocol document.

## Event and Command Contract

Full shapes, firing conditions, and failure behaviour live in
[`docs/SDK_PROTOCOL.md`](docs/SDK_PROTOCOL.md). In short:

```json
{ "source": "cv-embed", "version": "2", "event": "ready", "embedId": "cvembed_xxxxxxxx", "payload": {} }
```

```json
{ "source": "cv-embed-host", "version": "2", "command": "setResume", "embedId": "cvembed_xxxxxxxx", "payload": { "resume": {} } }
```

`validationChange` includes a machine-readable `issues` array with `severity`,
`section`, `code`, and `message`.

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
| Dates | Range / Compact / Short / Numeric / ISO | All outputs; Short uses two-digit years |
| Template | Minimal / Compact | Preview layout. PDF and DOCX use the ATS-friendly single-column layout. |
| Header Align | Center / Left | Preview and PDF/DOCX output |
| Density | Comfortable / Compact / Relaxed | Spacing scale in preview/PDF; DOCX uses line-height equivalent |
| Link Display | Short label / Full URL | Header links in all outputs |
| Visibility & Order | Per-section toggle + ↑↓ reorder | Form, nav, preview, and exports share one source of truth |

## Testing & QA

```bash
npm run test:unit   # Vitest unit tests
npm run test:e2e    # Playwright tests across desktop-chromium and mobile-chromium
npm run test        # Both suites
```

E2E coverage includes builder QoL flows, mobile view and import behavior, focus visibility, narrow-viewport reflow, production-safe embed payloads, SDK execution and lifecycle, PDF engine lazy loading per device class, and export menu behavior. CI runs lint, build, unit, and e2e on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

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
