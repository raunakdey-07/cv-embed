# CV-Embed — Build, Export, and Embed ATS-Friendly Resumes

CV-Embed is a fast resume builder built with React + TypeScript. It gives you a focused editing experience, live preview, PDF/DOCX export, and embed-ready sharing for portfolios, placement portals, and personal sites.

## Features

- **Resume Builder UI**: Structured sections for basics, education, experience, projects, skills, certifications, accomplishments, activities, volunteering, and publications.
- **Live Preview**: Real-time visual preview while editing with typography, density, and section-order controls.
- **Export Options**: Download polished resumes as **PDF**, **DOCX**, and raw **JSON**.
- **Embed Toolkit**: Generate a portable embed URL, iframe snippet, and SDK script integration block.
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

## Embed Example (SDK)

```html
<script src="https://your-domain.com/sdk.js"></script>
<div id="resume-container"></div>
<script>
  CVEmbed.render({
    target: '#resume-container',
    baseUrl: 'https://your-domain.com',
    resumeData: {/* normalized resume JSON */},
    options: { showDownload: false }
  });
</script>
```

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
