# CV-Embed — Build, Export, and Embed ATS-Friendly Resumes

CV-Embed is a fast resume builder built with React + TypeScript. It gives you a focused editing experience, live preview, PDF/DOCX export, and embed-ready sharing for portfolios, placement portals, and personal sites.

## Features

- **Resume Builder UI**: Structured sections for basics, education, experience, projects, skills, certifications, accomplishments, activities, volunteering, and publications.
- **Live Preview**: Real-time visual preview while editing with typography, density, and section-order controls.
- **Export Options**: Download polished resumes as **PDF**, **DOCX**, and raw **JSON**.
- **Embed Toolkit**: Generate a portable embed URL, iframe snippet, and SDK script integration block.
- **SDK v2 Bridge**: `postMessage` event API (`ready`, `heightChange`, `validationChange`, `sectionFocus`, `export`) with callback hooks.
- **Auto-height Embeds**: Resize-aware iframe integration for portal layouts.
- **Integration Pack Copy**: One-click copy for URL + iframe + React + SDK + event contract.
- **Host Controls**: Guided mode, debug mode, locked template, read-only sections, download/import toggles.
- **Validation & Scoring**: Inline error/warning checks with a resume quality score indicator.
- **Draft Persistence**: Saves progress in browser storage so your data survives refreshes.
- **Portable Data**: Import/export normalized resume JSON for backup and migration.

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
```

## Routes

- `/builder` — Main resume builder
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

## Manual UX QA

- Use `docs/ux-qa-matrix.md` to verify the 12 high-impact QoL upgrades on desktop and mobile.
- It includes step-by-step scenarios, expected behavior, and a reusable QA log template.

## PDF Benchmarking

- Use `docs/pdf-engine-benchmark.md` to measure local PDF engine latency and output size.
- Run benchmarks in dev from the builder toolbar lightning icon.

## Project Structure

```text
cv-embed/
├── public/
├── sdk/
├── src/
│   ├── app/                # Builder + embed pages
│   ├── components/
│   │   ├── sections/       # Editable resume sections
│   │   ├── templates/      # Resume templates/renderers
│   │   └── ui/             # UI icons/components
│   ├── docx/               # DOCX renderer
│   ├── pdf/                # PDF renderer
│   ├── lib/                # Utils, scoring, storage
│   ├── schema/             # Validators
│   └── types/              # Resume type definitions
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
