# CV-Embed Audit Results

Audit: `docs/CV_EMBED_AUDIT.md`
Baseline commit: `c2d3ca4`
Implementation date: 2026-09-24

## Verification Summary

| Check | Before | After |
| --- | --- | --- |
| `npm run lint` | Passed | Passed |
| `npm run build` | Passed | Passed, with production entry assertion |
| `npm run test:unit` | 3 passed | 79 passed across 8 files |
| `npm run test:e2e` | 13 passed, 11 skipped | 81 passed, 31 skipped across 3 projects |
| Production PDF preload | Present | Absent |
| `npm audit --omit=dev` | 4 high | 0 high after upgrading `docx` to 9.7.2 |

The 31 E2E skips are project-specific duplicates. Each test runs in the project where it applies, so the 81 passes cover desktop Chromium, mobile Chromium, and Firefox.

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

Resolved. `public/sdk.js` is now generated deterministically from `sdk/index.ts` with `npm run build:sdk`. `npm run build` runs `npm run check:sdk`, which compares the generated output with the checked-in artifact and fails on drift.

### CODE-001 shared renderer view model

Resolved for ordering, visibility, and meaningful-content decisions. `src/lib/contentChecks.ts` now exposes the ordered section list, visibility check, section-content check, and renderable section list used by the editor and all four renderers. Presentation and export formatting remain renderer-specific.

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
- `npm run test:unit`: 79 passed.
- `npm run test:e2e`: 81 passed, 31 project-specific skips.
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

- Unit tests: 79 passed across 8 files.
- E2E tests: 81 passed, with 31 intentional project-specific skips across 3 projects.
- Production build and entry assertion: passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
- DOCX 9.7.2 export path was exercised after the upgrade.
- No deployment or GitHub push was performed.

# Post-CI Remaining Risk Review

## Current risk table

| Risk | Still present? | Severity | Safe to fix? | External dependency? | Product decision? |
| --- | --- | --- | --- | --- | --- |
| 280-320 px header overflow | No | P1 | Fixed | No | No |
| SDK source/artifact drift | No | P1 | Fixed | No | No |
| Shared section ordering and visibility drift | No for ordering/visibility/content | P2 | Fixed | No | No |
| Portable link data in HTTP requests | No | P1 | Verified and tested | No | No |
| Full CJK/non-Latin PDF support | Yes | P1 | No | Font asset and licensing | No, but budget and UX approval needed |
| Compact PDF/DOCX parity | Yes | P1 | No | No | Yes |
| PDF benchmark heading coverage | Yes | P2 | Not safely | Reliable in-browser PDF text parser | No |
| DOCX pagination in Word/LibreOffice | Yes | P2 | Not proportionately | LibreOffice/Word runner | No |
| Shared private resume hosting | Yes | P1 future option | No | Backend/auth/storage | Yes |
| Undo for destructive actions | Yes | P2 | Architecture dependent | No | Yes |
| Print output | Yes, unclaimed | P3 | Not currently | No | Yes |
| Locale-specific dates | Yes, unclaimed | P3 | Not currently | No | Yes |
| Google font startup cost | Yes | P2 | Needs visual review | No | No |
| Non-Chromium CI projects | Yes | P2 | Possible later | Browser downloads | No |
| Quality score behavior | No known defect | P1 reviewed | Tests added; formula unchanged | No | Only if product changes rubric |

## Evidence and actions

### Responsive overflow

The CI failure was real and font-metric dependent. With the production web font loaded, the Import and Embed header action group measured 176.5 px and pushed the document to 323 px at a 280-320 px viewport. The fix makes the two header actions icon-only below 480 px while retaining 40 px touch targets and accessible names. The regression test now checks 280, 320, 375, 768, and 1024 px, including both document and body widths.

### SDK artifact

`public/sdk.js` is generated from `sdk/index.ts` using the existing Vite dependency. CI performs a non-writing build and compares the output byte-for-byte. This prevents the hand-maintained script from drifting again.

### Renderer view model

The shared model owns only:

- merged, de-duplicated section order
- visible versus hidden state
- meaningful section content

Each renderer still owns its markup, layout, and document-specific formatting.

### Portable link privacy

New browser coverage verifies that the embed iframe is requested and no request URL contains `data=`. Resume payloads remain in the URL fragment, where browsers do not transmit them in HTTP request targets. Links remain public to anyone who possesses them; authenticated or expiring hosting remains a product decision.

### Quality score

Representative tests now cover empty, Basics-only, sparse, balanced, high-quality, warning-heavy, long-content, many-section, hidden-section, and structurally invalid CVs. No discontinuity or misleading zero-state behavior was found, so the formula remains unchanged.

### PDF benchmark

The current browser benchmark searches compressed PDF bytes for heading text. PDF content streams are compressed, so this metric can report false negatives. Adding a PDF parser would affect the client or add a large dependency. The risk remains documented rather than adding an unreliable parser to production code.

### DOCX pagination

LibreOffice and Word are not available in the current environment. Adding a large office suite only for a benchmark would make CI slow and fragile. DOCX structure, Unicode, and keep-together properties remain tested; rendered pagination is documented as a future dedicated job.

### CJK PDF support

The guard remains. A full Noto Sans SC package is approximately 74.5 MB unpacked, which is not acceptable as an eager dependency. The error now names a small sample of unsupported characters and directs the user to DOCX. A per-script lazy font pipeline is still required before claiming CJK PDF support.

### Compact export

Preview-only behavior is accurate and documented. Matching the two-column preview in DOCX would require a table-based or section-based layout with dedicated ATS reading-order and pagination fixtures. It remains deferred rather than weakening the current single-column export.

### Print and locale

The product does not currently claim print-specific output or locale-aware dates. Adding either would be feature work rather than a regression fix, so both remain deferred.

### Destructive actions

Explicit remove controls exist for individual entries, but import replacement and row removal do not share a general undo system. A lightweight confirmation could be added, but a consistent undo experience requires product and state-architecture decisions.

# Post-CI Regression Pass

Date: 2026-09-26

## Mobile horizontal overflow

The first post-push CI run failed `builder reflows without page-level horizontal scrolling` in
`mobile-chromium` at the 280 px viewport: `scrollWidth` measured 323 against a 281 px client width.

A DOM probe identified the offender as `.app-header-actions`, which ended at 323.3 px. The
embedded web font metrics widened the Import and Embed buttons, and the header action group could
not shrink. `.section-nav-tabs` also overflowed, but that element is intentionally horizontally
scrollable and never widened the document.

The fix makes the Import and Embed controls icon-only squares below 480 px. Their `aria-label` and
`title` are unchanged, so the accessible name and the browser tooltip are identical. No global
`overflow-x: hidden` was added, because that would hide real overflow rather than remove it.

The regression test now checks 280, 320, 375, 768, and 1024 px against both `documentElement` and
`body`, and waits for `document.fonts.ready`. The font wait matters: with web fonts blocked the page
fit at 280 px, so the failure only appeared once metrics were applied.

| Viewport | `documentElement` scroll/client | `body` scroll/client |
| --- | --- | --- |
| 280 | 280 / 280 | 280 / 280 |
| 281 | 281 / 281 | 281 / 281 |
| 320 | 320 / 320 | 320 / 320 |
| 375 | 375 / 375 | 375 / 375 |
| 768 | 768 / 768 | 768 / 768 |
| 1024 | 1024 / 1024 | 1024 / 1024 |

## Generated SDK artifact

`public/sdk.js` was previously hand-maintained and could silently drift from `sdk/index.ts`.
`scripts/build-sdk.mjs` now builds the SDK as an IIFE and writes the artifact. `npm run build` runs
`check:sdk`, which fails when the checked-in file differs from the build output.

The IIFE exposes a module namespace, so the build appends `CVEmbed = CVEmbed.CVEmbed;` to preserve
the documented global contract of `window.CVEmbed.render(...)`. Without the footer the global became
`window.CVEmbed.CVEmbed.render` and both embed suites failed.

`getSdkScriptOrigin` now captures the script origin at module load rather than resolving it per
message, so origin validation is stable for the lifetime of the SDK.

## Shared section view model

`src/lib/contentChecks.ts` now owns section order, visibility, and meaningful-content decisions for
`BuilderPage`, `Minimal`, `Compact`, the PDF renderer, and the DOCX renderer. Markup, layout, and
document-specific formatting stay in each renderer. This removes duplicated business logic without
introducing a new presentation abstraction.

## Performance after this pass

| Metric | Baseline | Previous pass | This pass |
| --- | --- | --- | --- |
| First-visit transfer (Timing API) | about 648 kB | about 123 kB | 122.4 kB |
| PDF chunk requests on first visit | 1 | 0 | 0 |
| Main entry gzip | 36.38 kB | 41.24 kB | 41.46 kB |
| React vendor gzip | 73.65 kB | 74.39 kB | 74.39 kB |
| CSS gzip | 6.06 kB | 6.47 kB | 6.50 kB |
| PDF chunk gzip when requested | 529.90 kB | 529.19 kB | 529.06 kB |

Measured against `vite preview` on the production build at 1280x900. The page-count change did not
introduce PDF initialization: the build-time entry assertion and both PDF lazy-load E2E tests still
pass.

# Defect Remediation Pass

Date: 2026-09-28

An adversarial review reproduced the remaining risks against real artifacts.
This section records what was fixed, what was investigated and deliberately
left alone, and what remains a product decision or an external limit.

## Fixed

### PDF dropped or clipped unbreakable text (P1)

react-pdf breaks lines at word boundaries. A run with no break opportunity was
measured as one line: too wide meant the element was discarded or drawn past
the right edge and clipped. `pdftotext -bbox` on a 1000-character headline
listed every other word on the page and no headline at all.

Measured on generated PDFs, before and after:

| Fixture | Before | After |
| --- | --- | --- |
| 700-character headline | 0 of 700 present | 700 of 700 |
| 1000-character URL | 0 present | 1002 of 1002 |
| 1000-character bullet | cut at 87 characters | 1001 |
| 500-character skill token | cut at 87 characters | 501 |
| 300-character company name | 0 present | 300 |
| 20-sentence prose | unchanged | unchanged |

`wrapForPdf` does a greedy line fill that inserts explicit breaks inside
over-long runs, preferring common separators so a wrapped URL still reads as
one. It is a no-op for anything that already fits. The transform runs on a
render-time copy, so the editor, preview, DOCX, JSON, and stored data keep the
exact text the user typed. Nothing is truncated, clipped, or hidden.

### Tech Stack could not accept comma-separated input (P1)

The controlled input re-derived its value from the parsed array on every
keystroke, so React rewrote the DOM value and swallowed the comma the user had
just typed. "Go, Postgres, Kafka" became "GoPostgresKafka", and the corrupted
array was stored and exported.

Verified with generated artifacts: the PDF and DOCX both contained
`Tech: GoPostgresKafka`. After the fix both contain
`Tech: Go, Postgres, Kafka`.

The field now holds raw text and derives the list from it. Comma deletion,
pasting, trailing commas, duplicates, and emptying the field are all covered.

### Empty CV exported a fabricated identity (P2)

The PDF text of an empty CV was exactly `Your Name`. The placeholder is gone
from the PDF, DOCX, and both preview templates, and both exports refuse an
empty CV with a message saying what is missing.

### A dense CV could score quality 0 (P2)

The quality score charged three points per warning instance with no cap, so
length was punished without limit. Warnings are now counted per rule and
capped at two instances.

| Fixture | Completeness | Quality before | Quality after | Final before | Final after |
| --- | --- | --- | --- | --- | --- |
| empty | 0 | 0 | 0 | 0 | 0 |
| basics only | 43 | 38 | 38 | 41 | 41 |
| dense, short bullets | 100 | 64 | 85 | 82 | 93 |
| dense, long bullets | 100 | 0 | 73 | 50 | 87 |

The score shape is unchanged. Empty stays 0, cosmetic formatting still has
zero influence, hidden sections stay out of the requirements, and growth stays
monotonic. Two pieces of copy that promised more than the formula measures
were corrected.

### SDK configuration and update recovery (P2)

`update()` committed the merged config before building the URL, and
`buildEmbedUrl` throws on a malformed `baseUrl`. A host that passed a bad
value and caught the error left the instance permanently dead: the message
handler threw on every subsequent message. The config is now committed only
after the URL builds, so a failed update is a no-op. Both new tests fail
against the previous SDK.

`onHeightChange` reported the value the SDK had just refused to apply, so a
host could receive `NaN` into its own layout. It now reports the height the
iframe is actually sized to.

`readOnlySections` and `disableImport` are documented as metadata in the type,
the README, and the embed debug panel. The embed renders a read-only template
with no editing surface, so there is nothing for either option to lock.

### Unreadable drafts were silently destroyed (P2)

A draft that existed but could not parse returned null, the builder fell back
to an empty CV, and 900ms later the debounced save overwrote the original. The
raw bytes now move to `cvembed:draft:unreadable`, the autosave is held while
the resume is still empty, and the user is told. A merely partial draft still
normalizes and loads, which is the resilience worth keeping.

## Investigated and deliberately unchanged

- **Mobile section tab strip.** Not clipped. It is a working horizontal
  scroller: the page never scrolls horizontally at 320, 375, or 414px, and
  scrolling the strip brings the last tab fully into view. At 375px the strip
  holds 386px of content in 275px and Skills reaches right=284 against a strip
  edge of 284. Shortening labels or wrapping is a product decision.
- **Non-URL link values.** Already reported. The quality pill shows the
  warning count and opening it names the problem. Not inline is a design
  choice, not a defect. A test now locks in that it is reported.
- **Unknown `sectionOrder` keys.** Filtering to known keys is required by the
  type. Preserving them would need a forward-compatible representation.

## Compatibility

Firefox was added as a Playwright project running the cross-cutting suite.
The horizontal overflow regression is no longer mobile-only, because it is the
assertion most worth cross-checking: it awaits `document.fonts.ready` and
measures `documentElement` and `body` at 280, 320, 375, 768, and 1024px.

Firefox 146 passes the whole suite with no assertion relaxed and no
browser-specific branch, so no compatibility shim was needed.

## Font loading

Fonts moved from a CSS `@import` to a `<link>` with `preconnect`, because an
`@import` is a second-order dependency: the browser must fetch and parse the
app stylesheet before it discovers the font request.

Cold-cache request start times, production build:

| | Order |
| --- | --- |
| before | html 3ms, app assets 15ms, Google Fonts CSS 20-22ms |
| after | html 3ms, Google Fonts CSS 15ms, in parallel with app assets |

Transfer is unchanged: 122.2 kB same-origin, 99.7 kB of font payloads, 3 font
requests, 8 requests total. Nothing was preloaded and no font was added.
DOMContentLoaded and first contentful paint are within noise on localhost;
the measurable win is the removed serial dependency.

## Still open

Product decisions: Compact PDF and DOCX export, undo for destructive actions,
private or expiring portable links, print and locale output, and whether an
empty CV should be blocked outright or export with empty identity fields.

External limitations: full CJK PDF font support, Word or LibreOffice visual
pagination verification for DOCX, and PDF text extraction in production. The
CJK guard is retained deliberately: it refuses to emit a PDF it cannot render
and names the offending characters.

# Cross-Browser Release Hardening

Date: 2026-09-28

## Browser coverage

Coverage is by **browser engine**, using the builds Playwright ships. These are
not the branded browsers, and this repository makes no claim about them.

| Project | Engine | Device profile | Result |
| --- | --- | --- | --- |
| `desktop-chromium` | Chromium | Desktop Chrome | 47 passed |
| `mobile-chromium` | Chromium | Pixel 7 | 34 passed, 13 skipped |
| `firefox` | Gecko (Playwright build) | Desktop Firefox | 29 passed, 7 skipped |
| `webkit` | WebKit (Playwright build) | Desktop Safari | not run, see below |

Totals: 79 unit tests, 81 E2E passing, 31 project-scoping skips across three
projects. Every skip is a test declaring that it applies to a different
viewport or flow, and it self-skips. No test was excluded from Firefox to make
it pass.

## Geometry comparison, Chromium against Firefox

A DOM probe walked the rendered builder at 280, 320, 375, 768, and 1024px in
both engines, after `document.fonts.ready`, ignoring elements inside
containers that are themselves horizontally scrollable.

| Viewport | Document overflow | Body overflow | Out-of-bounds elements |
| --- | --- | --- | --- |
| 280 | 0 in both | 0 in both | none |
| 320 | 0 in both | 0 in both | none |
| 375 | 0 in both | 0 in both | none |
| 768 | 0 in both | 0 in both | none |
| 1024 | 0 in both | 0 in both | none |

Touch targets matched between engines at every width. No control fell below
24px in height at any mobile width. The two controls measured 38x23 at 1024px
in both engines, which is a desktop pointer context; below 900px they are
40x40.

The historical 280-320px overflow came from web font metrics widening the
header action group. That fix holds in Gecko, so no browser-specific CSS was
needed and none was added.

## Genuine compatibility bugs found

None. No application code changed in this milestone.

One test-quality defect was found and fixed. The empty-export test asserted
that no download occurred by waiting 500ms. A real PDF export dynamically
imports a 1.58MB chunk and takes roughly 1.7s, so a regression that removed
the guard would have completed after the window closed and the test would
still have passed. It now asserts on the mechanism instead: the guard must
short circuit before either renderer chunk is requested. Removing both guards
was confirmed to fail this test on Chromium and on Firefox, and restoring them
makes it pass.

## WebKit: blocked by the environment

WebKit could not be run here, so it was not added to the project matrix.

`npx playwright install webkit` downloads the browser successfully, but the
host cannot execute it. `ldd` on the WebKit binaries reports these unresolved:

```
libicudata.so.74, libicui18n.so.74, libicuuc.so.74, libjpeg.so.8, libjxl.so.0.8
```

The host has ICU 77 and libjpeg 62, and the machine has no package manager and
no root, so the required libraries cannot be installed. Symlinking ICU 77 onto
the `.so.74` sonames was tried and rejected: it produces ELF class errors, and
an ABI-mismatched ICU would make any WebKit result untrustworthy rather than
merely incomplete.

Adding an unverifiable project to CI would risk turning the pipeline red on a
commit that could not be tested, so the matrix is left at the browsers that
are actually exercised.

To enable it on a runner that can install system packages:

1. Add a project to `playwright.config.ts` using `devices['Desktop Safari']`
   with the same `testMatch` list the `firefox` project uses.
2. Change the install step in `.github/workflows/ci.yml` to
   `npx playwright install --with-deps chromium firefox webkit`.

`ubuntu-latest` runners have apt and Playwright installs these libraries
automatically with `--with-deps`. No application change is expected; the same
suite is engine-neutral by construction.

## Final gate

| Check | Result |
| --- | --- |
| `npm run lint` | passed |
| `npm run build` | passed |
| Production eager-PDF assertion | passed |
| `npm run check:sdk` | passed |
| `npm run test:unit` | 79 passed, 8 files |
| `npm run test:e2e` | 81 passed, 31 skipped, 3 projects |
| `npx playwright test --project=firefox` | 29 passed, 7 skipped |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `git diff --check` | clean |
| First-visit transfer | 122.3 kB same-origin, 222.0 kB with fonts, 8 requests |
| PDF chunk requests on first visit | 0 |

No dependency, lockfile, generated, or application file changed.
