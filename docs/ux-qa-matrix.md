# CV-Embed Manual UX QA Matrix (12 QoL Upgrades)

Use this checklist to validate the high-impact builder QoL upgrades across desktop and mobile.

## Environments

- Desktop: latest Chrome and Firefox, viewport >= 1280px
- Mobile: device toolbar or real device <= 900px width
- Data sets:
  - `clean`: valid resume with all major sections
  - `errors`: missing basics + malformed links + sparse sections
  - `heavy`: long bullets/projects to stress preview and export

## Pass Criteria

- No high-severity UX regressions.
- Keyboard shortcuts are reliable and non-conflicting.
- Export/Embed actions are responsive and recover correctly.
- Desktop and mobile behavior are consistent with intent.

## Checklist

### 1) Save Status + Relative Time

- Area: `BuilderPage` header save indicator.
- Steps:
  1. Edit any field.
  2. Confirm indicator changes to `Saving draft...` then `Saved just now`.
  3. Wait >60s and confirm relative time updates.
- Expected:
  - Status transitions correctly.
  - No flicker loops.

### 2) Completion Meter + Essentials Summary

- Area: completion strip.
- Steps:
  1. Start from sparse resume.
  2. Fill essentials one-by-one: basics core, education, experience/projects, 3+ skills, accomplishments.
  3. Observe percent and essentials counters.
- Expected:
  - Counters/percent increase predictably.
  - No negative jumps after unrelated edits.

### 3) Keyboard Shortcut: Export PDF (`Ctrl/Cmd+S`)

- Steps:
  1. Press `Ctrl/Cmd+S` in builder.
  2. Repeat while busy exporting.
- Expected:
  - Triggers PDF download when idle.
  - Does not queue duplicate overlapping exports while busy.

### 4) Keyboard Shortcut: Toggle Embed (`Ctrl/Cmd+Shift+E`)

- Steps:
  1. Toggle embed panel open and closed repeatedly.
  2. Edit content while panel open.
- Expected:
  - Panel toggles reliably.
  - No render loops or lockups.

### 5) Keyboard Shortcut: Jump to Next Issue (`Ctrl/Cmd+Shift+J`)

- Steps:
  1. Introduce known errors/warnings in multiple sections.
  2. Trigger shortcut from desktop and mobile edit mode.
- Expected:
  - Scrolls/focuses first essential gap or highest-priority issue section.
  - On mobile, switches to edit view first.

### 6) Completion Pills with Actionable Guidance

- Steps:
  1. Hover/focus Essentials pill.
  2. Hover/focus Fix-next pill.
  3. Click Fix-next pill.
- Expected:
  - Tooltips describe the next action.
  - Click action jumps to relevant section.

### 7) Score Pill + Rubric Popover

- Steps:
  1. Hover/focus score pill.
  2. Validate rubric readability and dismissal behavior.
- Expected:
  - Rubric appears with clear criteria.
  - Does not overlap critical actions on narrow widths.

### 8) Embed Presets + Custom Controls

- Steps:
  1. Open embed panel and switch among `Placement`, `Portfolio`, `Compact Showcase`, `Custom`.
  2. Change height/download in custom mode.
  3. Verify generated URL/snippets reflect values.
- Expected:
  - Presets apply expected defaults.
  - Manual edits switch preset to custom.

### 9) Embed Integration Pack + Copy Actions

- Steps:
  1. Use copy buttons for URL/iframe/react/sdk/pack.
  2. Paste and verify content integrity.
- Expected:
  - Clipboard content is correct.
  - Copy toast appears and clears.

### 10) Mobile View Switch + Bottom Actions

- Steps:
  1. In mobile layout, toggle `Edit`/`Preview` tabs.
  2. Use bottom buttons: Preview/Edit, Export, Embed.
- Expected:
  - Smooth view transitions.
  - Buttons remain reachable and stateful.

### 11) Mobile Export Sheet Behavior

- Steps:
  1. Open export sheet, tap outside to dismiss.
  2. Download PDF/DOCX/JSON from sheet.
- Expected:
  - Outside click closes sheet.
  - After export, mobile view behavior is correct (preview focus where intended).

### 12) Page Estimate Responsiveness (PDF Count Scheduling)

- Steps:
  1. Type continuously for 10-15 seconds in large resume.
  2. Open export menu and embed panel.
  3. Observe page indicator updates.
- Expected:
  - Typing stays smooth.
  - Page count updates opportunistically (idle) and quickly when export/embed context is opened.

## SDK v2 Bridge Sanity (Related)

Run `public/sdk-playground.html` checks after builder QA:

1. Render with sample resume and verify `ready` + `validationChange`.
2. Resize and ensure `heightChange` events arrive.
3. Scroll sections and verify `sectionFocus` events.
4. Trigger builder CTA/export path and verify `export` event payload.
5. Validate `update()` and `destroy()` behavior repeatedly.

## QA Log Template

- Date:
- Tester:
- Build SHA:
- Browser/Device:
- Scenario ID:
- Result: Pass | Fail
- Severity: High | Medium | Low
- Repro Steps:
- Notes/Screenshot:

## Pass 1 Findings (Code + Runtime Validation)

- Date: 2026-03-08
- Scope: Engineering verification pass (code-path + build/lint), not full manual click-through.
- Build SHA: `8d41c80`
- Branch: `main`

1. `Save Status + Relative Time` -> Pass by evidence
  - `src/app/builder/BuilderPage.tsx` save state transitions and relative time text are wired.
2. `Completion Meter + Essentials Summary` -> Pass by evidence
  - `src/app/builder/BuilderPage.tsx` completion math and pills are deterministic and section-aware.
3. `Ctrl/Cmd+S` export shortcut -> Pass by evidence
  - Keyboard handler guards with `busy` flag before export.
4. `Ctrl/Cmd+Shift+E` embed toggle shortcut -> Pass by evidence
  - Embed panel toggles and now uses stable panel-open gating.
5. `Ctrl/Cmd+Shift+J` jump-to-fix shortcut -> Pass by evidence
  - Jumps to essentials gap first, then first issue.
6. `Actionable completion pills` -> Pass by evidence
  - Hover/focus popovers and click action are wired.
7. `Score pill + rubric` -> Pass by evidence
  - Rubric appears via hover/focus and score is shown in header.
8. `Embed presets + custom controls` -> Pass by evidence
  - Presets map to defaults; manual overrides switch to custom.
9. `Embed integration pack + copy actions` -> Pass by evidence
  - URL/iframe/react/sdk/pack copy buttons all map to generated artifacts.
10. `Mobile view switch + bottom actions` -> Pass by evidence
   - Mobile tab and bottom action controls are present with stateful behavior.
11. `Mobile export sheet behavior` -> Pass by evidence
   - Outside click close + post-export state handling are wired.
12. `Page estimate responsiveness` -> Pass by evidence (improved)
   - Idle/urgent scheduler, cache, stale guard, and visual stale hint implemented.
   - Timing instrumentation is available via page-indicator metadata (`source`, `duration`, `updated`).

- Build: `npm run build` passed.
- Lint: `npm run lint` passed.

### Remaining for Pass 2 (Manual UX)

- Run full browser interactions on desktop + mobile and convert evidence-based statuses into interaction-verified pass/fail.
