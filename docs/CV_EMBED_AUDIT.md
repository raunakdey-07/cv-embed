# CV-Embed Production Audit

Audit date: 2026-09-24

> **Historical record.** This is the audit as written on 2026-09-24, against
> commit `c2d3ca4` and the deployment live at the time. It is kept because it is
> the source of the remediation work, not because it describes the current
> repository. Findings here have since been fixed, rejected, or deliberately
> deferred; see `CV_EMBED_AUDIT_RESULTS.md` for what happened to each. Test
> counts, browser coverage, and dependency numbers in this file are the
> September snapshot and do not match today. For the current state, read
> `SDK_PROTOCOL.md`, `PERFORMANCE.md`, and `RELEASING.md`.

This report covers the local repository at commit `c2d3ca4` and the deployed application at `https://cv-embed.vercel.app/`. The local build and live deployment served the same current application and SDK hashes during the audit.

## Executive Summary

CV-Embed has a sound small-SPA foundation: React and TypeScript are strict, the builder has one main resume state, section visibility and order are shared across the editor and renderers, PDF and DOCX engines are split into separate files, and CI runs lint, build, unit, and browser tests. The application is not yet safe to trust as a production CV builder, though.

The highest-risk findings are concrete:

- A malformed JSON import or portable resume can crash the whole app. A test import of `{ "education": {} }` produced `TypeError: education.forEach is not a function` and left an empty React root.
- The generated SDK snippet does not contain resume data. Running the exact live snippet produced `Resume not found`.
- The embed CTA opens `/builder` without transferring the visible resume.
- SDK auto-height cannot shrink below the initial 1,100 px iframe because the embed document is forced to `100vh`.
- PDF output corrupts CJK and other non-Latin text. A mixed Chinese, Latin, and emoji resume produced corrupted PDF text such as `—José =€` and `w /Remote`.
- The selected Compact template is not used by PDF or DOCX, despite documentation saying it applies to all outputs.
- The 1.59 MB PDF chunk is preloaded in production. The measured initial transfer was about 648 kB compressed, including 530 kB for the PDF chunk, on a blank first visit.
- Native focus indicators are removed from buttons. Keyboard focus moved through controls with `outline: none` and no replacement.
- Draft storage fails silently and gets stuck at `Saving draft...` when storage throws. It also does not survive closing and reopening the app.
- Validation and readiness require education, a project, three skills, phone, and an accomplishment in ways that do not fit many valid CVs. Accomplishments are hidden by default but can be the unfixable “next action.”
- `npm audit --omit=dev` reports 4 high-severity production dependency findings. React Router has a fixed release. DOCX has no current upstream fix for its nested `nanoid` advisory.

The recommended direction is conservative. Keep the SPA, the single resume model, current templates, and SDK v2 event names. Fix boundaries, persistence, accessibility, export safeguards, production lazy loading, and generated integration correctness first. Do not add accounts, dashboards, AI features, new templates, or a new state framework.

## Current Architecture

### Runtime and build

- React 19.2 and React DOM 19.2 SPA.
- TypeScript 5.9 in strict mode with project references.
- Vite 7 production build.
- React Router 7 with `BrowserRouter`.
- Zod 4 for structural validation.
- `@react-pdf/renderer` for PDF output.
- `docx` for DOCX output.
- npm and `package-lock.json` are the package manager and lockfile.
- CI is GitHub Actions with Node 22, lint, build, unit tests, Playwright install, and E2E tests.

### Entry points and routes

- `src/main.tsx` mounts `App` in React `StrictMode`.
- `/` and `/builder` render `BuilderPage`.
- `/embed/:resumeId` renders `EmbedPage`.
- `public/sdk-playground.html` is a static SDK test harness.
- There is no catch-all route. An unknown path renders only the app header.
- There is no SSR or server runtime in this repository.

### State and data flow

- `BuilderPage` owns the complete `Resume` object in one React state value.
- Child section components receive data and immutable update callbacks.
- Template visibility, order, and document options live under `resume.meta.documentOptions`.
- No Context, reducer, external state library, or server cache is used.
- Derived validation runs synchronously in `useMemo` on every resume change.
- Page estimation starts a delayed dynamic import of the PDF renderer and can overlap other PDF work.

### Data model and validation

- `src/types/resume.ts` defines the TypeScript model and factories.
- `src/schema/resumeSchema.ts` mirrors the model with Zod.
- `normalizeResume` in `src/lib/utils.ts` performs a shallow compatibility merge.
- `validateResume` first records Zod errors, then continues with manual checks that assume valid nested shapes.
- The current validation mixes structural errors, product advice, and arbitrary resume-style requirements.
- Issue identity is inferred later from English message strings in both builder and embed code.

### Persistence

- Drafts use `sessionStorage` under `cvembed:draft`.
- Named local embeds use `localStorage`, but no production code calls `saveEmbedResume`.
- Storage reads and writes are not consistently guarded.
- The draft save is debounced by 900 ms and is not flushed on page exit.
- Closing the current tab and opening a new one loses the draft.
- Portable embeds are self-contained because the full resume is encoded into the URL.

### Preview and export

- `MinimalTemplate` renders a single-column HTML preview.
- `CompactTemplate` renders a two-column HTML preview and uses a fixed primary/secondary section grouping.
- `TemplateRenderer` chooses one of those templates.
- `pdfRenderer.tsx` always renders a single-column A4 document and maps fonts to built-in Helvetica or Times fonts.
- `docxRenderer.ts` always renders a single-column document and maps fonts to Calibri, Consolas, or Times New Roman.
- Content-presence helpers are shared, but section rendering and formatting are duplicated across four renderers.
- PDF and DOCX are dynamically imported in source, but the production build preloads the PDF chunk.

### SDK and embed bridge

- `sdk/renderer.ts` is TypeScript SDK source.
- `public/sdk.js` is the shipped, independently maintained JavaScript copy.
- The SDK creates an iframe, sends resume data as an encoded query parameter, listens for `postMessage` events, and optionally applies auto-height.
- `EmbedPage` renders the resume, sends `ready`, `heightChange`, `validationChange`, and `sectionFocus`, and sends `export` when the builder link is clicked.
- The iframe sends to `eventOrigin`, which defaults to `*` when no SDK configuration is present.
- The SDK checks message source, version, and embed ID, but not event origin.
- Template locking is only applied to the unused local-storage resume path.

### Styling and layout

- One large global stylesheet in `src/index.css`.
- Dark application chrome with light resume paper previews.
- Desktop two-column builder above 1,100 px, single-column layout below it.
- Mobile Edit/Preview switch below 900 px.
- The right preview pane is not sticky and uses the page scrollbar.
- Google Fonts are loaded through one CSS `@import` for four font families.
- No print stylesheet exists.

### Tests and deployment

- Vitest runs one test file with three tests for a trivial next-action helper.
- Playwright runs eight spec files across Desktop Chrome and Pixel 7 profiles. The unchanged suite reported 13 passed and 11 intentionally skipped.
- Existing E2E tests run against the Vite development server, not the production preview.
- Vercel uses `vercel.json` with an SPA rewrite.
- `public/_headers` expresses cache rules, but the live Vercel response used `cache-control: public, max-age=0, must-revalidate` for both HTML and `sdk.js`.
- No analytics or telemetry service was found. Internal page-estimate timings are shown through a tooltip.

## Quality Gate Baseline

| Check | Command | Result |
| --- | --- | --- |
| Dependency tree | `npm ls --depth=0` | Passed |
| Lint | `npm run lint` | Passed |
| Typecheck and build | `npm run build` | Passed |
| Unit tests | `npm run test:unit` | 1 file, 3 tests passed |
| E2E tests | `npm run test:e2e` | 13 passed, 11 skipped |
| Production preview | `vite preview` on `/`, `/builder`, `/embed/portable` | All direct routes returned the SPA shell |
| Dependency audit | `npm audit --omit=dev --json` | Failed with 4 high-severity production findings |
| Formatting | No script or formatter configuration | Not available |
| Bundle visualization | No configured analyzer | Manual build and resource timing used instead |

### Build output

| Asset | Raw | Gzip |
| --- | ---: | ---: |
| Main application JavaScript | 145.73 kB | 36.38 kB |
| React vendor JavaScript | 230.00 kB | 73.65 kB |
| CSS | 33.29 kB | 6.06 kB |
| DOCX renderer | 347.25 kB | 101.48 kB |
| PDF renderer | 1,585.17 kB | 529.90 kB |

Measured blank first-visit resource transfer:

- Local production preview: 648,442 bytes for application JS, CSS, and the PDF chunk.
- Live production: 640,701 bytes for the same resources.
- PDF renderer share: about 518-530 kB transferred.
- Live navigation to `networkidle`: about 3.8 seconds in the audit environment.
- Local production navigation to `networkidle`: about 2.5 seconds in the audit environment.

These timings are environment measurements, not field Core Web Vitals.

### Live deployment comparison

- Live HTML references the same main, React vendor, CSS, and PDF hashes produced by the local build.
- Live `sdk.js` SHA-256 matched `public/sdk.js` exactly.
- Live HTML includes a module preload for the PDF chunk.
- Live `sdk.js` did not receive the 5-minute cache policy in `public/_headers`.

## Critical Findings

No P0 issue was confirmed. The application did not expose an unauthenticated remote-code path in its current client-only usage, and no secret was found.

The P1 findings below block a claim that users can trust CV-Embed with international resumes, portable integrations, persistence, and keyboard access.

## High Priority Findings

- REL-001: Malformed import or embed data can crash the app.
- DATA-001: Draft persistence can lose the latest edit and fails without recovery.
- SEC-001: Imported link values can become active unsafe document links.
- SEC-002: Full resume personal data is placed in HTTP request URLs.
- SEC-003: Production dependency audit has 4 high-severity findings.
- EMB-001: The generated SDK integration has no resume data.
- EMB-002: The embed-to-builder handoff loses the visible resume.
- EMB-003: Auto-height cannot shrink the iframe.
- A11Y-001: Buttons have no visible keyboard focus.
- EXP-001: PDF corrupts international Unicode text.
- EXP-002: PDF and DOCX ignore the selected Compact template.
- PERF-001: Production preloads the PDF renderer on first visit.
- VALID-001: Readiness and validation reject or hide valid CV choices.

## Medium Priority Findings

- UX-001: Blank entries and unconditional readiness copy make first use misleading.
- UX-002: Summary cannot be ordered or hidden consistently in the editor.
- REL-002: Import, clipboard, export, copy, and save failures lack user feedback.
- REL-003: Drafts do not survive close and reopen.
- A11Y-002: Repeated editor fields lack item context.
- A11Y-003: Destructive and touch controls are hidden or too small.
- A11Y-004: Disclosures and mobile view controls have incomplete semantics.
- SDK-001: Bridge origin checks fail open or are missing.
- SDK-002: Host options such as locked template are misleading or ineffective.
- SDK-003: SDK source and shipped SDK can drift.
- PERF-002: Page estimation and live embed previews can repeat expensive work.
- EXP-003: Long unbroken resume content is clipped in preview.
- EXP-004: Export pagination lacks entry and heading keep-together controls.
- DATE-001: Date inputs, parsing, and the Short option are inconsistent.
- CODE-001: Four renderers duplicate business and layout decisions.
- NAV-001: Unknown routes have no recovery UI.
- SEC-004: The benchmark server is exposed more broadly than intended.
- TEST-001: Automated tests miss core failure and export paths.

## Low Priority Findings

- COPY-001: Some UI exposes internal scheduler details and uses redundant developer copy.
- I18N-001: Month formatting is fixed to `en-US`.
- DESIGN-001: All selected font families load during initial application startup.
- EXP-005: Compact preview repeats contact data and does not honor centered headers.
- PRINT-001: Browser print output has no dedicated page layout.
- DOC-001: README and QA documents overstate behavior and completed coverage.

## UX Findings

### [UX-001] Blank entries and unconditional readiness make first use misleading

Severity:
- P1

Category:
- Product UX

Evidence:
- `createEmptyResume` supplies one blank Education item and empty arrays for other repeated sections.
- `EducationSection`, `ExperienceSection`, `ProjectsSection`, and optional sections manufacture a temporary item when their array is empty.
- Experience and Projects show a count of `1` before the user has added an entry.
- The embed panel says `Your resume is ready to embed` for a blank resume.
- Validation on first load reported 8 errors and 2 warnings while the preview contained only `Your Name`.

Location:
- `src/types/resume.ts:206-250`
- `src/components/sections/Education.tsx:9-16`
- `src/components/sections/Experience.tsx:9-15`
- `src/components/sections/Projects.tsx:9-15`
- `src/app/builder/BuilderPage.tsx:949-953`

User impact:
- New users see fake entries, misleading counts, dense forms, and a success claim before they have a usable CV.

Technical impact:
- UI state and stored data represent different things, which complicates validation and empty states.

Why it matters:
- The first screen should explain the next real action, not imply that placeholder cards are saved entries.

Recommended fix:
- Store empty repeated sections as empty arrays, render a short `No entries yet` state with the existing Add action, count only stored entries, and change embed copy to report draft status rather than unconditional readiness.

Regression risk:
- Medium. Existing E2E assumptions about placeholder entries and counts need updates.

Estimated effort:
- Medium.

Confidence:
- High.

### [UX-002] Summary organization does not match the editor model

Severity:
- P2

Category:
- Product UX and state consistency

Evidence:
- Summary is included in `sectionOrder` and renderers.
- The editor keeps Summary inside Basics, sets both Basics and Summary active, exempts Summary from hidden-state handling, and does not render a separate ordered Summary panel.
- The Organize sheet can hide or reorder Summary while its editor remains in Basics.

Location:
- `src/app/builder/BuilderPage.tsx:701-717`
- `src/app/builder/BuilderPage.tsx:762-794`
- `src/app/builder/BuilderPage.tsx:1063-1093`
- `src/types/resume.ts:15-26`

User impact:
- Organize controls do not accurately describe where the user edits Summary or whether it appears in the CV.

Technical impact:
- One logical section has two editor locations and special-case navigation logic.

Why it matters:
- Section organization should have one source of truth.

Recommended fix:
- Make Summary a normal ordered editor section. If that is not chosen, remove Summary from organization controls and document it as fixed content.

Regression risk:
- Medium.

Estimated effort:
- Medium.

Confidence:
- High.

### [REL-002] User operations fail without feedback or recovery

Severity:
- P2

Category:
- Reliability and feedback

Evidence:
- PDF and DOCX handlers use `finally` but no `catch`.
- Clipboard writes are uncaught.
- Import uses `alert('Invalid JSON')` for every parse or shape failure.
- Page-estimate errors are swallowed.
- Save, copy, and page states are not in live regions.
- Copy confirmation appears after all snippet cards and may be below the viewport.
- A storage exception produced an uncaught `SecurityError` and left the UI at `Saving draft...`.

Location:
- `src/app/builder/BuilderPage.tsx:259-268`
- `src/app/builder/BuilderPage.tsx:581-588`
- `src/app/builder/BuilderPage.tsx:627-662`
- `src/app/builder/BuilderPage.tsx:404-409`

User impact:
- Failures look like hangs, silent no-ops, or generic invalid-data messages.

Technical impact:
- Async operations lack a consistent result and announcement path.

Why it matters:
- Export and persistence are core actions and need specific, visible outcomes.

Recommended fix:
- Add one operation-status state, catch each operation, keep the current draft on failed import, and announce save, copy, export, and estimate results.

Regression risk:
- Low.

Estimated effort:
- Medium.

Confidence:
- High.

### [REL-003] Drafts do not survive close and reopen

Severity:
- P2

Category:
- Reliability and persistence

Evidence:
- Drafts are written only to `sessionStorage`.
- A browser probe saved `Persisted User`, closed the page, opened a new page in the same context, and found an empty name with no stored draft.
- README promises browser persistence but only explicitly says refresh survival.

Location:
- `src/lib/storage.ts:4-21`
- `src/app/builder/BuilderPage.tsx:232`

User impact:
- Users can lose a substantial editing session by closing the tab or browser.

Technical impact:
- Persistence semantics differ from common resume-builder expectations and the product's portability goal.

Why it matters:
- Losing a CV is more serious than adding another persistence backend.

Recommended fix:
- Use guarded `localStorage` for the same draft key and schema, retain the in-memory editor when storage is unavailable, and provide a clear save status.

Regression risk:
- Low to medium. Old session drafts should still be read as a fallback.

Estimated effort:
- Small.

Confidence:
- High.

## Design Findings

### [COPY-001] Internal diagnostics and redundant copy compete with user tasks

Severity:
- P3

Category:
- Content clarity and unslopify

Evidence:
- The page-count tooltip exposes scheduler source, internal duration, and update time.
- UI uses `Saving draft...` instead of `Saving draft…`.
- Embed copy says `Everything in one copy` and calls an iframe a `Drop-in JSX component`.
- The unslopify scanner produced mostly syntax and Markdown false positives. The accepted findings were ordinary clarity issues, not generic AI marketing prose.

Location:
- `src/app/builder/BuilderPage.tsx:561-579`
- `src/app/builder/BuilderPage.tsx:670-699`
- `docs/ux-qa-matrix.md:23-28`

User impact:
- Some labels explain implementation details instead of what will happen to the CV.

Technical impact:
- Low.

Why it matters:
- Clear labels reduce interpretation work.

Recommended fix:
- Keep timings in telemetry and use direct action copy such as `Copy all`, `React iframe`, and `Estimated PDF pages`.

Regression risk:
- Low. Some text-based tests may change.

Estimated effort:
- Small.

Confidence:
- High.

### [DESIGN-001] Initial UI loads every font family

Severity:
- P2

Category:
- Performance and design

Evidence:
- `src/index.css` imports Bricolage Grotesque, Syne, Azeret Mono, and Instrument Serif in one request.
- The application chrome and resume defaults use several of these families at once.
- The Google Fonts stylesheet request took 326-660 ms in the measured environments.

Location:
- `src/index.css:1`
- `src/index.css:31`
- `src/index.css:1114`
- `src/components/templates/Minimal.tsx:28`

User impact:
- Initial rendering waits on an external third party, and users with blocked or slow font access see fallback text.

Technical impact:
- The full font set is coupled to the application shell even when a resume uses one family.

Why it matters:
- The editor should not depend on a third-party font request for basic usability.

Recommended fix:
- Use stable system fallbacks for application chrome and load only the selected preview family, or self-host approved subsets after checking licenses and payload size.

Regression risk:
- Medium because visual metrics can change.

Estimated effort:
- Medium.

Confidence:
- High for the dependency; medium for the preferred font-loading design.

### [EXP-005] Compact preview repeats contact data and ignores centered headers

Severity:
- P2

Category:
- Export fidelity and visual clarity

Evidence:
- Compact renders email, phone, and location in the main header and again in the aside.
- Compact header CSS fixes `text-align: left` and the Header Alignment rule does not target `.resume-compact-header`.
- Compact also groups Summary, Experience, and Projects before all other configured sections, while Minimal, PDF, and DOCX use the configured order.

Location:
- `src/components/templates/Compact.tsx:25`
- `src/components/templates/Compact.tsx:222-259`
- `src/index.css:1550-1574`
- `src/index.css:1616-1619`

User impact:
- The preview contains duplicate contact details, the alignment control can have no effect, and Organize can imply an order the Compact template does not use.

Technical impact:
- Template-specific exceptions are not explained in the UI.

Why it matters:
- Resume output should not spend space repeating the same contact details.

Recommended fix:
- Render contact data once, apply both header alignments to Compact, and either preserve configured order or label Compact's grouping behavior clearly.

Regression risk:
- Medium.

Estimated effort:
- Medium.

Confidence:
- High.

## Accessibility Findings

No full WCAG conformance claim was made. The audit covered semantics, keyboard focus, accessible names, responsive reflow, long content, reduced-motion source behavior, and touch target sizing. It did not run a full screen-reader, browser-zoom matrix, or assistive-technology test suite.

### [A11Y-001] Buttons have no visible keyboard focus

Severity:
- P1

Category:
- Accessibility and keyboard use

Evidence:
- The global button reset uses `all: unset`.
- No replacement `button:focus-visible` rule exists.
- A production-preview keyboard probe moved through the first 12 focusable elements. Every sampled control had `outline-style: none`, outline width `0px`, and no box shadow.
- Two wrapper spans and one wrapper div add redundant tab stops.

Location:
- `src/index.css:50-57`
- `src/index.css:324-329`
- `src/index.css:757-761`
- `src/index.css:843-848`
- `src/app/builder/BuilderPage.tsx:876-925`
- `src/app/builder/BuilderPage.tsx:1128-1150`

User impact:
- Keyboard users cannot tell which control has focus.

Technical impact:
- Focus remains functional but is visually invisible.

Why it matters:
- The entire editor and export workflow depends on these controls.

Recommended fix:
- Add one high-contrast `:focus-visible` treatment for buttons and links, remove wrapper tab stops, and add a Playwright computed-style regression check.

Regression risk:
- Low.

Estimated effort:
- Small.

Confidence:
- High.

### [A11Y-002] Repeated editor fields lack item context

Severity:
- P2

Category:
- Forms and screen-reader navigation

Evidence:
- Repeated Experience, Project, Education, and other cards use generic labels such as `Company`, `Role`, and `Start`.
- Bullet textareas have placeholders but no programmatic labels.
- Skills inputs rely on placeholders.
- Removal buttons use `×` or an icon with only a generic title.

Location:
- `src/components/sections/Experience.tsx:45-67`
- `src/components/sections/Projects.tsx:49-71`
- `src/components/sections/Education.tsx:27-38`
- `src/components/sections/Skills.tsx:22-35`

User impact:
- Screen-reader users hear many indistinguishable fields and cannot tell which entry or bullet is active.

Technical impact:
- Visual context is not encoded in accessible names.

Why it matters:
- Form navigation is a core editor workflow.

Recommended fix:
- Add stable `name` and `id` values, item-aware `aria-label` text, and `fieldset`/`legend` where a repeated group benefits from it.

Regression risk:
- Low to medium because tests may use visible text.

Estimated effort:
- Medium.

Confidence:
- High.

### [A11Y-003] Destructive and touch controls are hidden or too small

Severity:
- P2

Category:
- Accessibility and touch interaction

Evidence:
- Card and bullet remove buttons are 20 by 20 px and hidden with `opacity: 0` until hover.
- Copy buttons are 22 by 22 px.
- Add controls are 22-24 px.
- Reorder controls are 20 by 20 px.
- Import replaces the current draft without undo or confirmation.
- Coarse-pointer CSS only changes popover display; it does not reveal or enlarge remove controls.

Location:
- `src/index.css:552-563`
- `src/index.css:1130-1137`
- `src/index.css:1160-1173`
- `src/index.css:1275-1288`
- `src/index.css:1323-1335`
- `src/index.css:1996-2012`

User impact:
- Touch users can miss controls or tap invisible remove targets.

Technical impact:
- Visual compactness is prioritized over target size and error recovery.

Why it matters:
- Accidental removal can lose CV content.

Recommended fix:
- Keep icons visually compact inside 40-44 px coarse-pointer targets, reveal remove controls on touch and keyboard focus, add contextual names, and use undo for non-empty removals or import replacement.

Regression risk:
- Medium.

Estimated effort:
- Medium.

Confidence:
- High.

### [A11Y-004] Disclosures and mobile view controls have incomplete semantics

Severity:
- P2

Category:
- Accessibility semantics

Evidence:
- Readiness and score popovers remain rendered while visually closed and are not connected to triggers with `aria-controls` or `aria-describedby`.
- The score popover uses dialog semantics without focus management.
- Format and Organize use dialog semantics for non-modal disclosure panels.
- Mobile Edit/Preview controls declare `tablist` and `tab` roles but have no tab panels, roving tab index, or arrow-key behavior.

Location:
- `src/app/builder/BuilderPage.tsx:843-863`
- `src/app/builder/BuilderPage.tsx:876-920`
- `src/app/builder/BuilderPage.tsx:1128-1150`
- `src/components/ui/SectionNav.tsx:101-164`

User impact:
- Assistive technology receives relationships and roles that do not match the interaction.

Technical impact:
- Pointer, hover, and screen-reader behavior are implemented separately.

Why it matters:
- The affected controls are used throughout the builder.

Recommended fix:
- Use button `aria-pressed` for the two-view switch, use disclosure semantics for sheets, and hide closed popovers from the accessibility tree with correct relationships.

Regression risk:
- Low to medium because role-based tests need updates.

Estimated effort:
- Small to medium.

Confidence:
- High.

## Performance Findings

### [PERF-001] Production preloads the PDF renderer on first visit

Severity:
- P1

Category:
- Performance

Evidence:
- `vite.config.ts` splits the PDF renderer into `pdfRenderer`, and the production HTML contains a module preload for that chunk.
- The existing lazy-load E2E test runs `vite dev`, where the production preload behavior is absent.
- Production-preview and live browser probes both fetched `pdfRenderer-*.js` on a blank first visit.
- The chunk transferred about 530 kB gzip, which was roughly 82% of measured application resource transfer.

Location:
- `vite.config.ts:7-18`
- `dist/index.html`
- `tests/e2e/pdf-lazy-load.spec.ts:32-70`
- `src/app/builder/BuilderPage.tsx:432-445`

User impact:
- Mobile and first-time visitors pay for a PDF engine before requesting an export.

Technical impact:
- Network, parse, memory, and main-thread costs are paid during startup.

Why it matters:
- The page editor can work without the PDF engine.

Recommended fix:
- Disable automatic module preload for the dynamic PDF import, remove automatic desktop page-count rendering, calculate PDF pages only when the export or embed flow needs them, and test the production preview rather than only the dev server.

Regression risk:
- Medium because the page-count indicator becomes lazy.

Estimated effort:
- Small.

Confidence:
- High.

### [PERF-002] Page estimation and embed preview can repeat expensive work

Severity:
- P2

Category:
- Runtime performance

Evidence:
- Every resume change schedules a delayed full PDF render on desktop.
- Clearing scheduled work does not cancel an already running `countPdfPages` call.
- Export menu and embed panel can start urgent work while the idle work is active.
- The embed iframe receives a new URL whenever the resume changes, even when its preview details are closed.
- PDF page estimation renders a full PDF and scans the blob text.

Location:
- `src/app/builder/BuilderPage.tsx:311-445`
- `src/app/builder/BuilderPage.tsx:1026-1034`
- `src/pdf/pdfRenderer.tsx:452-458`

User impact:
- Typing can coincide with PDF CPU and memory work, and a long resume can reload the embed preview repeatedly.

Technical impact:
- The scheduler is not strictly latest-wins once a render starts.

Why it matters:
- The editor should remain responsive while secondary calculations catch up.

Recommended fix:
- Use a single-flight latest-wins queue, invalidate jobs when scheduling changes, render the iframe only after its details are opened, and label the page count as PDF-only.

Regression risk:
- Medium.

Estimated effort:
- Medium.

Confidence:
- High for duplicate work; medium for visible impact on short resumes.

## Code Quality Findings

### [REL-001] Malformed import or embed data can crash the app

Severity:
- P1

Category:
- Reliability and boundary validation

Evidence:
- Imported, stored, and URL-decoded JSON are cast to `Resume` and passed to shallow `normalizeResume`.
- `normalizeResume` does not guarantee nested types.
- `validateResume` records a Zod failure and then calls array and object methods anyway.
- A production-preview import of `{ "education": {} }` produced `education.forEach is not a function` and left the root empty.

Location:
- `src/lib/utils.ts:120-176`
- `src/lib/storage.ts:11-38`
- `src/app/builder/BuilderPage.tsx:581-588`
- `src/schema/validators.ts:81-105`

User impact:
- A bad backup or crafted shared link can make the builder or embed unusable and can replace a valid in-memory draft with invalid state.

Technical impact:
- Runtime types are asserted at untrusted boundaries.

Why it matters:
- The app promises portable JSON import and self-contained embeds.

Recommended fix:
- Parse unknown input through one compatibility normalizer and one final Zod parse before state or render use. Reject invalid files and payloads with a useful message and keep the current draft on failure.

Regression risk:
- Medium because malformed historical drafts may have been tolerated.

Estimated effort:
- Medium.

Confidence:
- High.

### [VALID-001] Validation and readiness impose arbitrary or invisible requirements

Severity:
- P1

Category:
- Resume quality and product correctness

Evidence:
- Phone, at least one Education entry, at least one Project, and three distinct Skills are errors.
- Experience is only a warning.
- Accomplishments are part of the builder's essential checks but are hidden by default.
- The next-action resolver can select hidden Accomplishments, and the jump handler returns without action.
- Required checks do not account for `showSections`.
- Completeness counts non-empty arrays even when their entries are blank.
- The score rubric mentions measurable outcomes, but no measurable-outcome rule exists.

Location:
- `src/schema/validators.ts:45-79`
- `src/schema/validators.ts:93-139`
- `src/schema/validators.ts:183-231`
- `src/app/builder/BuilderPage.tsx:474-548`
- `src/app/builder/BuilderPage.tsx:796-808`
- `src/types/resume.ts:188-200`

User impact:
- Valid student, career-change, research, and region-specific CVs can appear invalid, and Fix Next can dead-end.

Technical impact:
- Structural validity, resume-style advice, and section completeness are mixed into one score.

Why it matters:
- Incorrect quality feedback reduces trust in the final CV.

Recommended fix:
- Reserve errors for missing name/contact and invalid structure, make contextual sections warnings, evaluate only visible sections, use meaningful-content predicates, and remove hidden-section actions from next-step logic.

Regression risk:
- Medium because scores and guidance will change.

Estimated effort:
- Medium.

Confidence:
- High.

### [CODE-001] Four renderers duplicate business and layout decisions

Severity:
- P2

Category:
- Maintainability and export consistency

Evidence:
- Minimal, Compact, PDF, and DOCX each implement section switches and formatting decisions.
- Current drift includes compact contact duplication, Compact section grouping, template mismatch, fallback labels, and accent-link differences.
- Shared content predicates reduce but do not eliminate duplication.

Location:
- `src/components/templates/Minimal.tsx:38-217`
- `src/components/templates/Compact.tsx:40-219`
- `src/pdf/pdfRenderer.tsx:140-301`
- `src/docx/docxRenderer.ts:155-280`

User impact:
- Fixes in one output do not reliably reach the others.

Technical impact:
- Small presentation changes require synchronized edits in large render functions.

Why it matters:
- Export fidelity depends on consistency, not file count.

Recommended fix:
- Derive one ordered, meaningful section view model. Keep format-specific presentation adapters. Do not build a generic layout engine.

Regression risk:
- Medium because refactoring can change output order and content.

Estimated effort:
- Large.

Confidence:
- High.

### [SDK-003] TypeScript SDK source and the shipped SDK can drift

Severity:
- P2

Category:
- SDK maintainability

Evidence:
- `sdk/renderer.ts` is not included in TypeScript project references and is not bundled into `public/sdk.js`.
- The implementations already differ in base URL defaults, resume ID encoding, and text encoding method.
- No test imports the TypeScript source or verifies the shipped artifact.

Location:
- `tsconfig.app.json:27`
- `tsconfig.node.json:25`
- `package.json:6-14`
- `sdk/renderer.ts:58-92`
- `public/sdk.js:31-57`

User impact:
- A reviewed SDK fix may not affect the file the application serves.

Technical impact:
- There is no generated-artifact check.

Why it matters:
- SDK correctness is a primary product surface.

Recommended fix:
- Select one canonical SDK source and generate or verify `public/sdk.js` in CI. Until then, change both copies in one reviewed batch and test the shipped file.

Regression risk:
- Low to medium.

Estimated effort:
- Medium.

Confidence:
- High.

### [TEST-001] Automated tests miss the highest-risk product paths

Severity:
- P2

Category:
- Testing

Evidence:
- The only unit tests cover a three-line helper.
- E2E tests use the development server and assert DOM state, not production assets, export artifacts, SDK execution, malformed data, or persistence failure.
- The embed test explicitly expects a short SDK snippet containing `resumeId` but never runs it.
- No tests cover validators, normalization, dates, URL safety, storage failure, long content, Unicode PDF output, DOCX package contents, or filename handling.

Location:
- `src/lib/nextAction.test.ts:1-16`
- `tests/e2e/embed-panel.spec.ts:29-37`
- `tests/e2e/pdf-lazy-load.spec.ts:32-70`
- `playwright.config.ts:24-28`

User impact:
- Green CI does not protect the workflows that create, preserve, embed, and export a CV.

Technical impact:
- Important behavior is verified only by manual inspection.

Why it matters:
- Regression tests should cover data loss, final artifacts, and public integration output.

Recommended fix:
- Add unit tests at normalization and validation boundaries, SDK tests against the shipped file, production-preview E2E, export artifact tests, and failure-path tests.

Regression risk:
- Low.

Estimated effort:
- Large.

Confidence:
- High.

## Reliability Findings

### [DATA-001] Draft persistence can lose the latest edit and fails without recovery

Severity:
- P1

Category:
- Reliability and data loss

Evidence:
- Saves are delayed by 900 ms and pending timers are canceled when state changes.
- There is no final save on `pagehide` or visibility change.
- `sessionStorage.getItem` and `setItem` are not fully guarded.
- A storage exception produced an uncaught `SecurityError` and left the save indicator at `Saving draft...`.
- Updated timestamps are added only to the persisted clone, not JSON or embed state.

Location:
- `src/app/builder/BuilderPage.tsx:259-268`
- `src/lib/storage.ts:7-21`
- `src/app/builder/BuilderPage.tsx:590-600`
- `src/app/builder/BuilderPage.tsx:647-649`

User impact:
- Closing during the debounce window can lose the latest edit. Blocked storage can look like a permanent save hang.

Technical impact:
- Persistence errors are not part of application state.

Why it matters:
- Data loss outweighs all visual polish.

Recommended fix:
- Guard storage, keep the in-memory resume, flush the latest snapshot on page exit, use local storage for cross-session drafts, and show a distinct save-error state.

Regression risk:
- Low.

Estimated effort:
- Small to medium.

Confidence:
- High.

## Security Findings

### [SEC-001] Imported link values can become active unsafe document links

Severity:
- P1

Category:
- Security and input validation

Evidence:
- URL fields accept arbitrary strings.
- Project, certification, activity, and publication links are checked with `startsWith('http')`; basic links are not checked.
- Values flow to React `href`, PDF `Link`, and DOCX `ExternalHyperlink`.
- A local no-write export probe confirmed that the PDF and DOCX libraries can serialize a `javascript:` URI as an active external relationship.
- React currently blocks some dangerous browser navigation, but export libraries do not provide the same protection.

Location:
- `src/schema/resumeSchema.ts:16-19`
- `src/schema/validators.ts:132-180`
- `src/components/templates/Minimal.tsx:99-100`
- `src/components/templates/Minimal.tsx:169-170`
- `src/components/templates/Minimal.tsx:232-233`
- `src/pdf/pdfRenderer.tsx:194-195`
- `src/docx/docxRenderer.ts:117-128`

User impact:
- A malicious imported CV can place active unsafe links in files sent to recruiters.

Technical impact:
- The application relies on downstream libraries to filter untrusted URLs.

Why it matters:
- Export code is a security boundary.

Recommended fix:
- Parse URL strings with `URL`, allow only intended schemes, and omit hyperlink behavior for every other value. Apply the same helper in HTML, PDF, and DOCX.

Regression risk:
- Low to medium if users rely on `mailto:`, `tel:`, or custom schemes.

Estimated effort:
- Small to medium.

Confidence:
- High.

### [SEC-002] Full resume personal data is placed in HTTP request URLs

Severity:
- P1

Category:
- Privacy and embed security

Evidence:
- The complete resume is Base64URL encoded into `?data=`.
- Generated iframe, React, and SDK snippets all use query-string payloads.
- Base64 is reversible and does not encrypt personal data.
- Query strings can enter browser history, clipboard managers, reverse proxies, CDN logs, and request telemetry.

Location:
- `src/lib/utils.ts:92-118`
- `src/app/builder/BuilderPage.tsx:59-70`
- `sdk/renderer.ts:85-92`
- `public/sdk.js:50-57`

User impact:
- Anyone with a link can recover the CV, and service logs may retain personal data.

Technical impact:
- The static deployment has no opaque resume store or expiry model.

Why it matters:
- Resume data includes identity, contact, location, employment, and links.

Recommended fix:
- Keep compatibility with existing query links while generating new static links with data in the URL fragment. Add a clear public-link warning and payload-size guidance. A durable solution requires an opaque server-side ID and retention policy, which is a public deployment change.

Regression risk:
- Medium for link format changes.

Estimated effort:
- Small for fragment compatibility; large for durable server storage.

Confidence:
- High.

### [SEC-003] Production dependency audit has 4 high-severity findings

Severity:
- P1

Category:
- Supply-chain security

Evidence:
- `npm audit --omit=dev --json` reported 4 high-severity production findings.
- `react-router-dom` and its vendored `react-router` are affected by published advisories. A fixed `react-router` release is available at 7.18.2 or later.
- `docx` depends on a vulnerable nested `nanoid` version. npm reported no available fix for the current `docx` release.
- The application uses BrowserRouter rather than the affected React Server Components and unstable RSC redirect paths, which reduces observed reachability but does not justify shipping known high advisories.

Location:
- `package.json:16-22`
- `package-lock.json`

User impact:
- Known vulnerable code ships to every browser visitor and export flow.

Technical impact:
- The router update is low risk if isolated and tested. The DOCX issue has no upstream fix.

Why it matters:
- Dependency risk must be triaged separately from exploitability.

Recommended fix:
- Upgrade React Router in a dedicated change with changelog review and full verification. Track the DOCX advisory and re-audit on the next upstream release. Do not force an unverified transitive override.

Regression risk:
- Low for the router upgrade; high for an unverified DOCX override.

Estimated effort:
- Small for React Router; unknown for DOCX.

Confidence:
- High for audit output; medium for current application exploitability.

### [SEC-004] Benchmark server is exposed more broadly than intended

Severity:
- P2

Category:
- Development service security

Evidence:
- The optional benchmark server has no authentication and does not default to loopback-only binding.
- A request can launch up to 12 Chromium pages.
- The request reader rejects above 2 MB but does not stop buffering the remaining request body.

Location:
- `scripts/chromium-benchmark-server.mjs:60-166`

User impact:
- If run on a shared interface, another host can consume browser, CPU, memory, and network resources.

Technical impact:
- A development utility can behave like an open resource-exhaustion endpoint.

Why it matters:
- The script is optional but should be safe when started.

Recommended fix:
- Bind to `127.0.0.1` by default, destroy oversized requests, and bound concurrency. Require an explicit token if non-loopback access is enabled.

Regression risk:
- Low.

Estimated effort:
- Small.

Confidence:
- High.

## Export Quality Findings

### [EXP-001] PDF corrupts international Unicode text

Severity:
- P1

Category:
- Export fidelity and correctness

Evidence:
- PDF maps all selected fonts to built-in Helvetica or Times fonts.
- No Unicode font is registered or embedded.
- A mixed-script test resume containing `张伟 — José 🚀`, Chinese headline and location, and Chinese education/activity text produced a 2-page PDF.
- `pdftotext` extracted the name as `—José =€`, the location as `w /Remote`, and Chinese location text as `w`.

Location:
- `src/pdf/pdfRenderer.tsx:26-50`
- `src/pdf/pdfRenderer.tsx:304-323`

User impact:
- International candidates can send a PDF with corrupted or missing identity and location text. ATS text extraction can also fail.

Technical impact:
- Built-in PDF fonts cover a limited character set.

Why it matters:
- A visually intact PDF can still have a corrupt text layer.

Recommended fix:
- Register and embed a Unicode-capable font, or block PDF export with a specific unsupported-character message until a font is available. A full font solution requires an asset-size and licensing decision.

Regression risk:
- Medium to high because font metrics affect wrapping, page count, and file size.

Estimated effort:
- Medium to large.

Confidence:
- High.

### [EXP-002] PDF and DOCX ignore the selected Compact template

Severity:
- P1

Category:
- Export fidelity

Evidence:
- The HTML renderer chooses Minimal or Compact.
- PDF and DOCX have no `resume.meta.template` branch.
- A saved Compact resume produced a single-column PDF and DOCX.
- README says Template applies to all outputs.

Location:
- `src/components/templates/TemplateRenderer.tsx:11-18`
- `src/pdf/pdfRenderer.tsx:127-324`
- `src/docx/docxRenderer.ts:283-381`
- `README.md:138-153`

User impact:
- The final artifact does not match the chosen layout or preview.

Technical impact:
- Page count, hierarchy, and reading order differ by format.

Why it matters:
- Export fidelity is a core product promise.

Recommended fix:
- Implement Compact in both file renderers, or make the control explicitly preview-only and remove the false all-output claim. A faithful two-column DOCX implementation needs pagination and ATS reading-order tests.

Regression risk:
- High if layout is changed after users have chosen a template.

Estimated effort:
- Large.

Confidence:
- High.

### [EXP-003] Long unbroken resume content is clipped in preview

Severity:
- P2

Category:
- Export fidelity and responsive content

Evidence:
- Resume rows and links do not have a general wrapping rule.
- Mobile preview canvas uses `overflow: hidden`.
- At a 320 px viewport, a test resume produced a 286 px template client width and an 11,168 px scroll width. The canvas had a 288 px client width and an 11,169 px scroll width.
- The page itself did not scroll horizontally, so content was clipped instead of reachable.

Location:
- `src/index.css:1499-1673`
- `src/index.css:2113-2115`
- `src/components/templates/Minimal.tsx:99-100`
- `src/components/templates/Minimal.tsx:208-210`

User impact:
- Long names, URLs, credential IDs, and unbroken pasted text can disappear from preview.

Technical impact:
- The renderer does not set explicit wrapping or overflow boundaries.

Why it matters:
- Hidden preview content makes export debugging unreliable.

Recommended fix:
- Add `min-width: 0` and controlled `overflow-wrap` to resume text and links, and test long content from 320 px upward.

Regression risk:
- Low to medium because wrapping changes line count.

Estimated effort:
- Small.

Confidence:
- High.

### [EXP-004] Export pagination lacks entry and heading keep-together controls

Severity:
- P2

Category:
- Export fidelity

Evidence:
- PDF rows and items have no keep-together policy.
- DOCX section titles and rows have no `keepNext` or `keepLines` settings.
- PDF uses 20-28 pt padding; generated DOCX uses Word's default one-inch margins.
- The page indicator is calculated only from PDF but displayed as generic export pages.

Location:
- `src/pdf/pdfRenderer.tsx:103-123`
- `src/pdf/pdfRenderer.tsx:140-301`
- `src/docx/docxRenderer.ts:57-100`
- `src/docx/docxRenderer.ts:375-381`
- `src/app/builder/BuilderPage.tsx:565-579`

User impact:
- Entries can split across pages and headings can be separated from content. DOCX can paginate differently from the estimate.

Technical impact:
- Format-specific pagination rules are absent.

Why it matters:
- Page-break quality strongly affects recruiter readability.

Recommended fix:
- Keep section headings with the first entry, avoid splitting entries that fit on a page, align page geometry where practical, and label the estimate PDF-only.

Regression risk:
- Medium because forced breaks can create white space.

Estimated effort:
- Medium.

Confidence:
- High for missing controls; medium for frequency in Word.

### [DATE-001] Date inputs, parsing, and the Short option are inconsistent

Severity:
- P2

Category:
- Input correctness and output quality

Evidence:
- UI placeholders and examples advertise `MMM YYYY`.
- The formatter parses only `YYYY-MM` and `YYYY-MM-DD`; `MMM YYYY` is returned unchanged.
- Invalid months and days can be accepted and silently reformatted.
- The `short` style returns the same full month and year as the default style.
- All five date choices appear in the UI, but Short and Range produce the same content.

Location:
- `src/lib/utils.ts:21-89`
- `src/components/sections/Education.tsx:35-36`
- `src/components/sections/Experience.tsx:51-52`
- `src/components/sections/DocumentOptions.tsx:68-75`

User impact:
- Users can receive raw or misleading dates in every output.

Technical impact:
- Input grammar, parsing, validation, and labels are maintained separately.

Why it matters:
- Dates are core resume content.

Recommended fix:
- Choose one accepted grammar, support the format shown in the UI, validate calendar dates, and either define Short correctly or remove it through a migration decision.

Regression risk:
- Medium because all outputs use these helpers.

Estimated effort:
- Small to medium.

Confidence:
- High.

### [PRINT-001] Browser print output has no dedicated page layout

Severity:
- P3

Category:
- Export fidelity

Evidence:
- No `@media print`, print page size, or page-break rules exist.
- The browser can still print the preview or use Save as PDF.

Location:
- `src/index.css`

User impact:
- Browser print can include application chrome and uncontrolled margins.

Technical impact:
- Print is not an explicit output contract.

Why it matters:
- Users may use browser print when PDF export is blocked or unavailable.

Recommended fix:
- Add scoped A4 print styles and hide application chrome, or clearly direct users to the PDF export.

Regression risk:
- Low.

Estimated effort:
- Small.

Confidence:
- High for absence; medium for user demand.

## SDK / Embed Findings

### [EMB-001] Generated SDK integration has no resume data

Severity:
- P1

Category:
- SDK correctness

Evidence:
- `buildEmbedArtifacts` encodes data only into the portable iframe URL.
- The generated SDK snippet uses `resumeId: 'portable'`.
- No code calls `saveEmbedResume`.
- The exact live snippet created `/embed/portable?...` without `data` and rendered `Resume not found`.
- Existing E2E only checks that the snippet text contains `resumeId`.

Location:
- `src/app/builder/BuilderPage.tsx:59-83`
- `src/app/embed/EmbedPage.tsx:91-105`
- `src/lib/storage.ts:24-39`
- `tests/e2e/embed-panel.spec.ts:29-37`

User impact:
- The advertised advanced integration does not work when pasted.

Technical impact:
- The generated code and runtime resolver use different data models.

Why it matters:
- SDK correctness is a primary product surface.

Recommended fix:
- Without changing the public SDK API, generate the snippet with the existing `resumeData` option using the same encoded resume payload. Add a test that executes the exact generated snippet.

Regression risk:
- Medium because the snippet becomes data-bearing and can be large.

Estimated effort:
- Small to medium.

Confidence:
- High.

### [EMB-002] Embed-to-builder handoff loses the visible resume

Severity:
- P1

Category:
- Embed correctness and data continuity

Evidence:
- The embed CTA links to plain `/builder`.
- The builder initializes only from its own draft.
- A live portable embed and CTA probe opened a blank or unrelated builder.

Location:
- `src/app/embed/EmbedPage.tsx:264-273`
- `src/app/builder/BuilderPage.tsx:232`

User impact:
- A user who opens a shared CV and chooses to edit it cannot reliably continue from that CV.

Technical impact:
- No handoff exists between the embed and builder.

Why it matters:
- Preview-to-edit continuity is a core product action.

Recommended fix:
- Carry the encoded resume through a backward-compatible fragment, read it in the builder, validate it, and let explicit draft precedence remain predictable.

Regression risk:
- Medium because URLs become data-bearing and builder initialization changes.

Estimated effort:
- Small to medium.

Confidence:
- High.

### [EMB-003] Auto-height cannot shrink the iframe

Severity:
- P1

Category:
- SDK correctness

Evidence:
- `.app-shell` has `min-height: 100vh`.
- `EmbedPage` measures `document.documentElement.scrollHeight`.
- A short SDK resume started at 1,100 px and emitted only 1,100 px height events.
- The iframe remained 1,100 px after render.

Location:
- `src/index.css:61`
- `src/app/embed/EmbedPage.tsx:180-208`
- `sdk/renderer.ts:165-197`
- `public/sdk.js:139-181`

User impact:
- Most embeds carry large blank space and cannot shrink after a tall update.

Technical impact:
- The measured document includes a viewport-sized shell rather than only resume content.

Why it matters:
- Auto-height is a documented SDK feature.

Recommended fix:
- Remove the viewport minimum for embed routes and test short, tall, and tall-to-short updates.

Regression risk:
- Medium.

Estimated effort:
- Small.

Confidence:
- High.

### [SDK-001] Bridge origin checks fail open or are missing

Severity:
- P2

Category:
- SDK and embed security

Evidence:
- Invalid or missing `eventOrigin` becomes `*`.
- The SDK does not set an event target origin by default.
- The host SDK checks message source, protocol version, and embed ID, but not `event.origin`.
- Accepted height values are not capped.

Location:
- `src/app/embed/EmbedPage.tsx:61-67`
- `src/app/embed/EmbedPage.tsx:134-148`
- `sdk/renderer.ts:175-198`
- `public/sdk.js:165-181`

User impact:
- A navigated iframe at another origin can retain the same `contentWindow` identity and forge accepted callbacks or request a very large iframe height.

Technical impact:
- The bridge trusts window identity without binding it to the expected origin.

Why it matters:
- `postMessage` origin validation is required for cross-frame trust.

Recommended fix:
- Default SDK event delivery to the host page origin, reject invalid iframe targets, validate inbound event origin against the configured embed origin, and cap heights.

Regression risk:
- Medium for integrations that depend on wildcard delivery.

Estimated effort:
- Small to medium.

Confidence:
- High.

### [SDK-002] Host options are misleading or ineffective

Severity:
- P2

Category:
- SDK contract correctness

Evidence:
- `lockedTemplate` is applied only to local-storage resumes, not decoded `resumeData`.
- The live playground selected `lockedTemplate: compact` and rendered zero Compact templates.
- `readOnlySections` is echoed in events and debug text but no editor enforces it.
- `disableImport` is sent but EmbedPage does not use it.
- `showDownload` controls an `Open in Builder` link, not a download action.
- README calls these enforced host controls.

Location:
- `src/app/embed/EmbedPage.tsx:75-118`
- `src/app/embed/EmbedPage.tsx:150-178`
- `sdk/renderer.ts:8-18`
- `README.md:18`

User impact:
- Integrators can make incorrect hosting, compliance, and event assumptions.

Technical impact:
- The public contract promises behavior the implementation does not provide.

Why it matters:
- Incorrect SDK semantics are worse than a smaller explicit contract.

Recommended fix:
- Apply template lock after all resume sources load. Until an editor exists, document read-only and import options as metadata only and rename the builder-link control honestly.

Regression risk:
- Low for documentation and template lock; high for implementing a new embedded editor.

Estimated effort:
- Small for the safe subset.

Confidence:
- High.

## Testing Gaps

- No unit tests for normalization, validation, scoring, date formatting, URL safety, storage, filenames, or payload limits.
- No SDK unit or browser contract tests.
- No test executes the exact generated SDK snippet.
- No production-preview E2E project.
- Existing PDF lazy-load test uses the dev server and misses production preloading.
- No export test opens PDF or DOCX content.
- No Unicode export test.
- No malformed-import or malformed-embed test.
- No storage-denied or quota test.
- No close-and-reopen persistence test.
- No keyboard computed-style test.
- No 320 px long-content test.
- No unknown-route test.
- No test for filename characters or length.
- No cross-browser SDK suite.
- CI does not type-check `sdk/`.
- No check keeps `public/sdk.js` synchronized with `sdk/renderer.ts`.
- Manual QA documents describe “code evidence” as runtime pass evidence and do not include current results for the missing paths.

## Positive Findings

- The live deployment matches the current local build and shipped SDK hash.
- TypeScript is strict and no unnecessary `any` was found in application source.
- The builder uses one main resume state and immutable section updates.
- Default factories return fresh nested objects.
- Section order normalization removes duplicates and unknown IDs.
- Content-presence helpers are shared.
- PDF and DOCX renderers are file-separated and dynamically imported in source.
- The production build emits readable chunk names and reasonable base application sizes.
- No `dangerouslySetInnerHTML`, `eval`, `document.write`, or secret-like literal was found in application source.
- External HTML links use `rel="noreferrer"`.
- SDK-created iframes have titles, lazy loading, and a referrer policy.
- SDK resize observers, event listeners, and instance destroy paths have cleanup.
- Embed source, version, and embed ID are checked before host callbacks run.
- The mobile layout uses 16 px form controls to avoid mobile zoom and 40 px primary nav targets.
- Zoom is not disabled in the viewport meta tag.
- The build, lint, strict typecheck, unit suite, and current E2E suite pass on the unchanged baseline.
- The SDK playground can render, update, and destroy an instance.
- A 30-bullet stress fixture used by the export review produced an 8-page PDF without dropping bullets, showing that ordinary long PDF flow works even though page-break policy needs improvement.

## Recommended Roadmap

### Phase 0: Critical fixes

#### SEC-003: Upgrade React Router

- Exact problem: The installed production router has high-severity advisories.
- Exact files: `package.json`, `package-lock.json`.
- Implementation: Upgrade `react-router-dom` to a fixed 7.18.2 or later release in one isolated change. Read release notes, inspect the lockfile diff, and do not include the DOCX issue in the same change.
- Tests required: `npm run lint`, `npm run build`, unit, E2E, production preview route checks, and `npm audit --omit=dev`.
- Regression risks: Routing behavior and bundle size.

#### REL-001 and DATA-001: Add a safe persistence and import boundary

- Exact problem: Malformed data crashes the app; storage errors lose feedback; latest edits can be lost.
- Exact files: `src/lib/utils.ts`, `src/lib/storage.ts`, `src/app/builder/BuilderPage.tsx`, new unit tests.
- Implementation: Normalize unknown input, run final schema validation, guard local storage, migrate session drafts as a fallback, save to local storage, flush on page exit, and add explicit save/import states.
- Tests required: Unit tests for malformed top-level and nested data, valid partial legacy options, blocked storage, corrupted storage, and timestamped persistence. E2E test same-file re-import, mobile import, and close/reopen.
- Regression risks: Previously tolerated malformed drafts and first-load state precedence.

#### SEC-001 and SEC-002: Secure link handling and generated portable links

- Exact problem: Unsafe URL schemes can reach exported documents; resume PII enters request URLs.
- Exact files: `src/lib/utils.ts`, `src/lib/contentChecks.ts` or a small URL helper, all renderers, `BuilderPage`, `EmbedPage`, `sdk/renderer.ts`, `public/sdk.js`.
- Implementation: Allowlist URL schemes, make exported hyperlinks conditional on a safe URL, generate new fragment-based links while reading existing query links, and warn users that shared links expose resume content.
- Tests required: Malicious URL tests across HTML/PDF/DOCX, old query-link compatibility, new fragment-link loading, and no resume data in HTTP request targets for generated links.
- Regression risks: Existing links and users who depend on non-web schemes.

#### EMB-001, EMB-002, EMB-003, SDK-001, and SDK-002: Repair embed and SDK behavior without changing event names

- Exact problem: Generated SDK code is empty, builder handoff loses data, auto-height cannot shrink, origin checks are incomplete, and template lock is ignored.
- Exact files: `BuilderPage`, `EmbedPage`, `App`, `sdk/renderer.ts`, `public/sdk.js`, `index.css`, embed and SDK tests.
- Implementation: Use existing `resumeData` in generated SDK snippets, pass encoded data through a compatible fragment for builder handoff, apply template lock after source selection, remove the embed viewport minimum, set a safe default event origin, validate inbound origins, cap heights, and align UI labels with actual behavior.
- Tests required: Execute the exact generated SDK snippet, builder handoff, short/tall/tall-to-short auto-height, locked template for both resume sources, origin rejection, update, destroy, and reinitialize.
- Regression risks: Existing embed URLs and wildcard event integrations.

#### A11Y-001: Restore visible focus

- Exact problem: Keyboard focus is invisible.
- Exact files: `src/index.css`, wrapper markup in `BuilderPage`, E2E tests.
- Implementation: Add a consistent `:focus-visible` ring, remove wrapper tab stops, and preserve visible form focus.
- Tests required: Keyboard traversal with computed outline or box-shadow assertions.
- Regression risks: Minimal visual change.

### Phase 1: High-impact UX and performance

#### PERF-001 and PERF-002: Make PDF work truly on demand

- Exact problem: The 530 kB gzip PDF chunk is preloaded and page-count work can overlap.
- Exact files: `vite.config.ts`, `BuilderPage`, production-preview Playwright config or tests, `pdfRenderer`.
- Implementation: Disable automatic module preload, remove idle page estimation, use one latest-wins on-demand queue, and label the count PDF-only.
- Tests required: Production-preview network assertions on blank load, export-menu trigger, rapid editing, and stale-result prevention.
- Regression risks: Page count appears later.

#### UX-001, UX-002, and VALID-001: Correct first use, organization, and readiness

- Exact problem: Placeholder entries, false ready copy, hidden next actions, and arbitrary valid-CV rules reduce trust.
- Exact files: `src/types/resume.ts`, all repeated section components, `BuilderPage`, `validators`, `nextAction` and tests.
- Implementation: Use real empty states, make Summary a normal section or explicitly fixed, remove Accomplishments from essentials, evaluate only visible sections, use meaningful-content checks, and reserve errors for true blockers.
- Tests required: Sparse student CV, career-change CV, hidden-section validation, next-action navigation, and section order tests.
- Regression risks: Readiness percentages and UI copy change.

#### A11Y-002, A11Y-003, and A11Y-004: Repair form context, targets, and disclosure semantics

- Exact problem: Repeated fields are ambiguous, touch targets are small, hidden remove controls are risky, and tab/dialog semantics are incomplete.
- Exact files: Section components, `SectionNav`, `BuilderPage`, CSS, E2E tests.
- Implementation: Add item-aware names, correct input types and autocomplete attributes, enlarge coarse-pointer targets, reveal destructive controls on touch and focus, use `aria-pressed` for Edit/Preview, and use correct disclosure relationships.
- Tests required: Keyboard and accessible-name checks, Pixel target-size checks, and screen-reader-oriented DOM assertions.
- Regression risks: Slightly larger mobile layout.

#### REL-002: Add operation feedback

- Exact problem: Save, import, copy, export, and estimate failures are silent or generic.
- Exact files: `BuilderPage`, CSS, E2E tests.
- Implementation: Catch each operation and announce a concise result in a status region near the action or preview header.
- Tests required: Clipboard denial, export exception, invalid import, successful copy, and storage failure.
- Regression risks: Low.

### Phase 2: Quality and reliability

#### EXP-001: Add Unicode-safe PDF output

- Exact problem: Built-in PDF fonts corrupt international text.
- Exact files: `pdfRenderer`, font assets, export tests, documentation.
- Implementation: Select and embed an approved Unicode font with a measured size. Until then, add a preflight error for unsupported characters so the app never silently produces a corrupt PDF.
- Tests required: CJK, Cyrillic, Arabic, accented Latin, emoji, and mixed-script PDF text extraction.
- Regression risks: Font size, licensing, wrapping, and page count.

#### EXP-002 and EXP-005: Resolve Compact export fidelity

- Exact problem: Compact is preview-only in practice and contains contact/order inconsistencies.
- Exact files: `Compact`, PDF renderer, DOCX renderer, shared view model, document-options UI, export fixtures.
- Implementation: Decide whether Compact is a supported file template. If yes, implement it with ATS-safe reading order and pagination tests. If no, label it preview-only and remove the false promise.
- Tests required: Minimal and Compact visual, text-order, page-count, and link tests.
- Regression risks: High visual and pagination changes.

#### EXP-003, EXP-004, DATE-001, and filename handling

- Exact problem: Long content clips, page breaks are uncontrolled, date grammar is inconsistent, and filenames are unbounded.
- Exact files: CSS, PDF renderer, DOCX renderer, date utilities, BuilderPage, tests.
- Implementation: Add controlled wrapping, keep-together rules, one accepted date grammar, and one filename sanitizer.
- Tests required: Long unbroken content, page-boundary fixtures, leap dates, invalid months, and Unicode/reserved filename cases.
- Regression risks: Line breaks and page counts change.

#### CODE-001, SDK-003, and TEST-001: Reduce drift and add regression coverage

- Exact problem: Four renderers and two SDK implementations can diverge.
- Exact files: Shared resume view model, SDK build config, test files, CI.
- Implementation: Derive one ordered meaningful-content model, establish one SDK source of truth, and add unit, artifact, production-preview, and failure-path tests.
- Tests required: All existing gates plus renderer, SDK, schema, storage, and production asset tests.
- Regression risks: Refactor can expose existing differences.

#### SEC-004: Harden the benchmark server

- Exact problem: The optional server is not loopback-safe by default.
- Exact files: `scripts/chromium-benchmark-server.mjs`.
- Implementation: Bind locally, stop oversized bodies, and cap concurrency.
- Tests required: Request-size and concurrent-run checks.
- Regression risks: Low.

### Phase 3: Polish

#### COPY-001, I18N-001, DESIGN-001, NAV-001, PRINT-001, and DOC-001

- Exact problem: Internal copy, fixed locale, font startup cost, missing route recovery, absent print rules, and overstated docs reduce clarity.
- Exact files: Builder copy, date utilities, CSS font loading, `App`, print CSS, README, QA docs, deployment headers.
- Implementation: Simplify labels, add an explicit locale strategy, reduce or self-host font cost, add a not-found route, scope print styles, align docs with tests, and configure Vercel cache/security headers.
- Tests required: Copy snapshots where useful, locale/date tests, 320-480-900 px checks, print emulation, unknown-route E2E, and deployed header checks after release.
- Regression risks: Low to medium.

## Stop-Condition Items Not Changed During Initial Implementation

The following items may require explicit approval because they change a public contract, data model, dependency foundation, or major output architecture:

- Replacing the public SDK event union or removing existing SDK options.
- Replacing the static portable URL model with a server-side opaque resume service and retention policy.
- Replacing the DOCX dependency or forcing a transitive `nanoid` override without an upstream fix.
- Replacing the current PDF engine or committing a very large CJK font asset after licensing and size review.
- Implementing a full Compact DOCX/PDF template redesign.
- Removing a user-visible feature rather than correcting or documenting it.

## Audit Limitations

- No Lighthouse service or field analytics was available.
- No full screen-reader test was run.
- No Firefox or WebKit E2E project exists.
- LibreOffice was not available, so DOCX pagination was inspected from source and package XML rather than rendered in Word-compatible software.
- Network timing came from one local and one live environment and should not be treated as global user data.
- The production deployment was not modified during the audit.
