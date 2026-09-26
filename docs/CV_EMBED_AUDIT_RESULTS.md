# CV-Embed Audit Results

Audit: `docs/CV_EMBED_AUDIT.md`
Baseline commit: `c2d3ca4`
Implementation date: 2026-09-24

## Verification Summary

| Check | Before | After |
| --- | --- | --- |
| `npm run lint` | Passed | Passed |
| `npm run build` | Passed | Passed, with production entry assertion |
| `npm run test:unit` | 3 passed | 51 passed across 6 files |
| `npm run test:e2e` | 13 passed, 11 skipped | 28 passed, 20 skipped across 2 projects |
| Production PDF preload | Present | Absent |
| `npm audit --omit=dev` | 4 high | 0 high after upgrading `docx` to 9.7.2 |

The 20 E2E skips are project-specific duplicates. Each test runs in the project where it applies, so the 28 passes cover both desktop and mobile behavior.

## Issues Fixed

### REL-001: Malformed import or embed data can crash the app

`normalizeResume` now parses unknown input defensively, fills missing legacy fields, rejects wrong nested shapes, and finishes with Zod validation. Import, storage, and URL decode paths keep the current draft when parsing fails. Unit and E2E coverage verifies that `{ "education": {} }` no longer blanks the builder.

### DATA-001 and REL-003: Draft persistence can lose work

Drafts now save to guarded `localStorage`, fall back to `sessionStorage` when local storage is blocked, read old session drafts, flush on `pagehide`, and show `Draft not saved` when both scopes fail. The editor remains usable in memory when storage is unavailable.

### SEC-001: Unsafe imported links

Added one URL boundary for HTML, PDF, and DOCX. Only complete `http://` and `https://` values become hyperlinks. Unsafe values remain visible as plain text, so a malicious import cannot create an active `javascript:` relationship in an exported document.

### SEC-002: Resume data in request URLs

New portable and builder handoff links put the encoded resume in the URL fragment. Legacy `?data=` links remain readable. The SDK also uses the fragment for `resumeData`. The link is still public to anyone who has it, which is documented in the README.

### SEC-003: React Router advisories

Upgraded `react-router-dom` and `react-router` from 7.13.1 to 7.18.4 in one isolated dependency change. The official changelog and the reduced audit output were checked. The remaining DOCX advisory is listed under deferred work.

### EMB-001, EMB-002, EMB-003, SDK-001, and SDK-002

- Generated SDK snippets now carry a script-safe encoded `resumeData` payload and execute correctly.
- The embed CTA carries the visible resume into the builder through a fragment handoff.
- Embed routes no longer have a `100vh` minimum, so auto-height can shrink.
- Template locks apply to both stored and portable resume sources.
- SDK event origins default to the host origin, inbound messages validate `event.origin`, and heights are capped.
- Duplicate SDK instances in one target are destroyed before replacement.
- `readOnlySections` and import policy are documented as metadata rather than implied enforcement.

### PERF-001 and PERF-002

Removed automatic PDF module preload, stopped idle PDF page estimation, made estimates latest-wins, and stopped rendering the embed preview iframe until the user opens its details. The production entry now has no static PDF import. The build fails if a future change reintroduces one.

### UX-001, UX-002, and VALID-001

- New resumes start with real empty arrays and clear `No entries yet` states.
- Summary is a real ordered editor section instead of a special case inside Basics.
- Readiness checks use the same visible-section rules as validation.
- Hidden sections cannot become the next unfixable action.
- Phone, education, projects, skills, and long bullets are no longer universal errors.
- Validation now reserves errors for missing identity/contact and structural problems, and shows the actual next issue in the Fix next popover.

### A11Y-001 through A11Y-004

- Added visible `:focus-visible` rings and a skip link.
- Removed redundant wrapper tab stops.
- Added item-aware names, stable input names, autocomplete attributes, and correct contact input types.
- Revealed destructive controls on coarse pointers and gave them larger hit areas.
- Corrected mobile Edit/Preview semantics to pressed buttons.
- Hid closed popovers from the accessibility tree and added live status regions.
- Added a recovery route for unknown URLs.

### EXP-003, EXP-004, EXP-005, and DATE-001

- Long unbroken content wraps in the preview and no longer creates an 11,000 px hidden scroll area at 320 px.
- PDF entries receive keep-together hints and headings receive presence hints.
- DOCX section titles and rows use keep-together properties.
- Contact details are no longer duplicated in Compact.
- The Short date style is now a real two-digit-year format.
- PDF and DOCX filenames are sanitized and bounded.

### EXP-001 safety guard

PDF export now refuses characters that the built-in PDF fonts cannot represent and tells the user to use DOCX or replace the unsupported characters. This prevents the previously observed silent corruption. A full Unicode font asset remains deferred.

## Performance Results

Measured with a blank first visit to the local production preview:

| Measurement | Before | After |
| --- | ---: | ---: |
| Application resource transfer | 648,442 bytes | 122,990 bytes |
| PDF requests on first visit | 1 | 0 |
| PDF share of transfer | about 530 kB | 0 |
| Main entry gzip | 36.38 kB | 41.24 kB |
| React vendor gzip | 73.65 kB | 74.39 kB |
| CSS gzip | 6.06 kB | 6.47 kB |
| PDF chunk when requested | 529.90 kB | 529.19 kB |
| Local navigation to `networkidle` | about 2.5 s | about 1.9 s |

The main entry grew by about 4.5 kB gzip because shared schema and normalization code must stay in the initial bundle for the main application. The result is still about 526 kB less first-visit transfer than the baseline.

The live deployment was not redeployed during this task. Its pre-implementation assets still show the old PDF preload and old focus styles until the next Vercel release.

## Export Verification

A mixed Chinese, Latin, and emoji resume was exercised against the real builder:

- PDF export now stops with a specific unsupported-character message.
- DOCX export completes and preserves accented text.
- A safe resume downloads as `José Example.pdf` and `José Example.docx` instead of using the raw name.
- A safe one-page PDF remains A4 and contains the expected extracted text.
- A previous long-content probe produced eight A4 pages and retained all 30 bullets.

## Tests Added

- Resume normalization and legacy field tests.
- Malformed nested input tests.
- URL safety tests.
- Guarded storage and blocked-storage tests.
- Visibility-aware validation tests.
- PDF text-support tests.
- Filename tests.
- E2E generated SDK execution.
- E2E embed-to-builder handoff.
- E2E SDK template lock, height shrink, and instance replacement.
- E2E keyboard focus and skip link.
- E2E mobile import chooser.
- E2E 320 px long-content reflow.
- E2E unsafe link rendering.
- E2E unknown-route recovery.
- E2E production-style PDF on-demand behavior through the development and build assertions.
- `scripts/check-production-build.mjs` guards the production entry against eager PDF imports.

## Issues Intentionally Not Fixed

### EXP-001 full Unicode PDF font

The safe guard is implemented, but the PDF engine still uses built-in Helvetica/Times fonts. A full fix needs an approved font asset, licensing review, bundle-size decision, and page-metric tests. It was not silently replaced with a large unverified font.

### EXP-002 Compact PDF/DOCX template parity

Compact remains a preview-only layout. PDF and DOCX intentionally keep the ATS-friendly single-column layout, and the UI and README now state this. Implementing a two-column DOCX with reliable ATS reading order and pagination requires a separate design decision.

### SEC-002 durable opaque resume hosting

Fragment links reduce request-log exposure but do not make a shared CV private. A server-side opaque ID, expiry, revocation, and retention policy would change the public deployment model.


### SDK-003 single generated SDK source

The TypeScript SDK and shipped `public/sdk.js` were updated together and the shipped file is covered by E2E tests. A generated-artifact build pipeline and CI drift check remain future work.

### CODE-001 shared renderer view model

The four renderers still have separate presentation code. The changes removed the highest-risk drift and added shared URL/content checks, but a full view-model refactor was not necessary for this pass.

### DESIGN-001 font loading

All Google font families still load during startup. Replacing that with self-hosted subsets or a font-selection loader needs a visual and licensing review.

### Undo for destructive actions

Remove controls are now visible, named, and touch-sized, but a general undo system for item removal and import replacement is not implemented.

## Remaining Risks

- The live Vercel deployment must be released before users receive the fixes.
- The DOCX dependency advisory is resolved.
- Full international PDF export still requires a font asset.
- The SDK still has no durable server-side `resumeId` storage.
- Compact preview order and export order are intentionally different.
- DOCX pagination was inspected through package XML, not rendered in Word or LibreOffice.
- Only Chromium desktop and mobile profiles run in CI.
- No full screen-reader audit or field Web Vitals data was available.

## Final Gate Record

The final command sequence was run on the completed tree:

- `npm run lint`: passed.
- `npm run build`: passed.
- Production entry assertion: passed.
- `npm run test:unit`: 51 passed.
- `npm run test:e2e`: 28 passed, 20 project-specific skips.
- `npm audit --omit=dev --json`: reports 0 vulnerabilities after the DOCX upgrade.

# Finalization Pass

Date: 2026-09-25

## Default section semantics

A new CV is created only by `createEmptyResume`. It has exactly five visible sections, in this order:

1. Summary
2. Education
3. Experience
4. Projects
5. Skills

The sections are visible but empty. Education, experience, projects, and skills contain no placeholder entries. Optional sections remain hidden until the user enables them.

`normalizeResume` is used for imports, drafts, and handoff payloads. It does not apply the new-CV defaults to supplied data. Explicit `showSections` values are preserved. A legacy object without a visibility configuration gets visibility inferred from meaningful content, so an imported CV is not silently reset to the default five-section configuration.

Regression coverage:

- `src/lib/utils.test.ts` covers the default factory, explicit visibility, legacy inference, malformed input, and missing fields.
- `tests/e2e/default-state.spec.ts` covers the fresh browser state, empty states, ordering, and persisted visibility.

## Readiness and quality score semantics

The score is content-based. Section presence, default formatting, and visible-but-empty sections contribute no completion points.

The current rubric keeps the existing error and warning penalties, then applies the existing completeness checks as a content-coverage multiplier:

- `completenessScore` is the percentage of visible, meaningful content checks passed.
- `penaltyAdjustedQuality` is `100 - errors * 15 - warnings * 3`, capped at 0 and 100.
- `qualityScore` is `penaltyAdjustedQuality * completenessScore / 100`.
- `score` is the rounded average of `qualityScore` and `completenessScore`.

A completely empty CV therefore has `qualityScore: 0`, `completenessScore: 0`, and `score: 0`. Basics-only content receives a partial score. Adding meaningful visible Education, Project, or Skills content increases the score. Hidden sections do not block the score. Default formatting does not increase it.

The builder shows `Quality: 0/100`, `0%`, and `Add your name and contact details to begin.` for a new CV.

## Page-count semantics

Page counting is split into three states:

- Empty CV: `Preview pages: 1`, determined without importing the PDF renderer.
- Non-empty CV before measurement: `PDF pages: not checked`.
- Non-empty CV after export or embed tools request a measurement: the measured PDF page count, with a stale indicator while recalculating.

The measured count is associated with the current Resume object identity. Editing the CV invalidates the old count instead of displaying it as current. The PDF chunk remains dynamically imported and the production build assertion verifies that the entry does not import it eagerly.

Tests in `tests/e2e/default-state.spec.ts` cover empty, one-page, and long multi-page content. Existing mobile and desktop tests confirm that the PDF chunk is not requested on first visit.

## Additional finalization fixes

- `docx` was upgraded from 9.6.0 to 9.7.2. It now resolves `nanoid 6.0.1`, and the production audit is clean. The generated DOCX bundle remains dynamic.
- PDF entries now stay together only when short. Long entries are allowed to flow across pages, preventing the earlier one-page clipping regression.
- SDK and EmbedPage message handlers reject malformed payloads without throwing.
- SDK resume IDs are path-encoded consistently in the TypeScript source and shipped script.
- Section-focus tracking now uses the most-visible section and can report a section taller than the viewport.
- Persistence tests cover local-over-session precedence, unknown fields, malformed drafts, blocked storage, and session fallback.
- Compact remains explicitly preview-only for PDF and DOCX. No export claim was added.

## Remaining-risk classification

### A. Safe to fix now, completed

- Default section and empty-state semantics.
- Content-based zero score for an empty CV.
- Deterministic empty page count without PDF loading.
- Legacy/imported visibility preservation.
- DOCX advisory upgrade.
- Malformed bridge payload rejection.
- Conditional PDF page-break behavior.

### B. Needs more investigation

- Full Unicode PDF support. The current guard is correct. A free Noto CJK package is about 74.5 MB unpacked, and a full CJK font asset would materially change the PDF chunk and page metrics. It needs a deliberate font, licensing, and payload decision.
- Compact PDF/DOCX parity. This needs ATS reading-order and pagination fixtures before implementation.
- A single generated SDK source. The TypeScript and public implementations are currently tested together but still maintained as separate files.
- A shared ordered renderer view model. The four renderers still contain duplicated presentation logic.
- PDF benchmark text extraction. The current benchmark searches compressed PDF bytes and is not a trustworthy heading-coverage signal.

### C. Intentionally deferred

- General undo for destructive item removal and import replacement.
- Server-side opaque resume IDs and retention controls.
- Self-hosted or selectively loaded web fonts.
- Print-specific CSS and locale-aware month output.
- Additional cross-browser SDK execution beyond the current Chromium projects.

### D. Blocked by external dependencies or assets

- CJK PDF rendering needs an approved font asset and its licensing/distribution decision.
- Word-compatible DOCX pagination still needs LibreOffice or Word rendering in CI.
- The original DOCX advisory is no longer blocked; it was resolved by the 9.7.2 upgrade.

### E. Product decision required

- Whether Compact is a supported file template or preview-only.
- Whether shared links should become private, expiring, or revocable.
- Whether a future quality score should reward outcome metrics more explicitly.
- Whether a full embedded editor is required for `readOnlySections` and `mode: edit` to become enforced options.

## Finalization verification

- Unit tests: 51 passed across 6 files.
- E2E tests: 28 passed, with 20 intentional project-specific skips across 2 projects.
- Production build and entry assertion: passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
- DOCX 9.7.2 export path was exercised after the upgrade.
- No deployment or GitHub push was performed.
