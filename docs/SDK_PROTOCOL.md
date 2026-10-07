# CV-Embed SDK v2 protocol

This document is the contract between a host page and a CV-Embed frame. It is
implemented once, in [`sdk/protocol.ts`](../sdk/protocol.ts), and both ends
validate against it. If this document and that file disagree, the file is the
bug.

## Transport

`window.postMessage` in both directions. Two envelopes:

```ts
// embed -> host
{ source: 'cv-embed',      version: '2', event:    string, embedId: string, payload: object }

// host -> embed
{ source: 'cv-embed-host', version: '2', command:  string, embedId: string, payload: object }
```

`version` is the **protocol version**. `CVEmbed.protocolVersion` reports what
this SDK speaks, and `CVEmbed.version` reports the SDK package version. The two
are independent: a patch release of the SDK does not change `version`.

`embedId` is generated per instance and is in every message in both
directions. A message carrying a different `embedId` is dropped, so several
embeds can share a page without seeing each other's traffic.

## Versions and compatibility

| Constant | Meaning | Bump when |
| --- | --- | --- |
| `PROTOCOL_VERSION` | wire format | any breaking change to a message name, envelope field, or payload shape |
| `SDK_VERSION` | SDK package | any SDK release, breaking or not |

Behaviour when versions do not match:

- The SDK drops any inbound event whose `version` is not `PROTOCOL_VERSION`.
- The embed drops any inbound command whose `version` is not `PROTOCOL_VERSION`,
  and answers with an `error` event using code `unsupported-protocol` and
  `fatal: true`, so the host learns why nothing is happening.
- A missing or non-string `version` is rejected the same way as a mismatch.

This is deliberately the whole compatibility story. A peer speaking a different
protocol is told to update rather than being allowed to half-work.

### What counts as breaking

Bump `PROTOCOL_VERSION` if you change any of:

- an envelope field name, or add one the receiver would treat as required
- a message or command name, or remove one
- a payload field's name, type, or requiredness
- which side a message travels on

Adding an **optional** payload field, or adding a new event or command that
older peers ignore, is not breaking. Unknown names are dropped on receipt, so an
older SDK receiving a newer event simply does nothing with it.

## Host to embed

Sent with `instance.send(command, payload)`. Returns `false` only when the
frame is gone. Commands sent before the frame has loaded are queued by the
browser and delivered when it does; the embed tolerates them either way.

### `syncState`

Re-emits `ready` and `validationChange`.

- payload: `{}`
- repeatable: yes
- use: the host attached late, or wants to re-sync after a tab was backgrounded

### `setResume`

Replaces the whole document. The embed re-renders and re-emits `ready` and
`validationChange`.

- payload: `{ resume: object }`, required
- repeatable: yes
- to *update* a CV, copy what you already sent, change the parts you want, and
  send it again. There is no merge command, so there is no merge semantics to
  get wrong
- rejected with `resume-invalid` when the payload is not an object containing
  `basics`, or when it fails schema validation. The current document stays on
  screen. This is stricter than importing a JSON file, because a rejected
  replacement would otherwise blank a CV the viewer is already reading

### `focusSection`

Scrolls a section heading into view and moves focus to it, honouring
`prefers-reduced-motion`.

- payload: `{ section: string }`, required, non-empty
- matched case-insensitively against the rendered `h2` text, for example
  `"Experience"`, not `"experience-2"`
- repeatable: yes
- rejected with `command-failed` when no rendered section matches

### `requestExport`

Asks where the embed sends a viewer who wants the document as a file. The embed
renders and routes; it never generates a file itself.

- payload: `{ format: 'pdf' | 'docx' | 'json' }`, defaults to `pdf`
- repeatable: yes
- answered with an `export` event carrying `requestedFormat`, the format you
  asked for, so you can match the reply to this request. A reader who takes the
  builder link reports `requestedFormat: null`, which is how the two triggers
  stay distinguishable
- the reply carries `url`, a builder link holding your document in its
  fragment. Send the viewer there. The format you named is honoured by the
  builder, not by the embed
- a `format` outside the list is refused with an `error` event using code
  `command-failed`, rather than being dropped in silence
- a document too large for a portable link is refused with `resume-too-large`.
  It has no handoff, so the embed reports that instead of returning a bare
  builder URL that would open an empty editor
- formats: PDF, DOCX, and JSON, all produced in the builder

### `setOptions`

Overrides configuration that otherwise comes from the iframe URL.

- payload, all optional: `primaryColor: string | null`, `density: 'comfortable' | 'compact' | null`, `showDownload: boolean`
- repeatable: yes
- `null` clears an override and falls back to the URL configuration

## Embed to host

Delivered to `events`, and to `onMessage` after validation and before dispatch.
`ready` is repeatable and idempotent: a repeat restates current state, it does
not mean a second instance.

### `ready`

The handshake. Fires once the document has rendered and been validated, and again
whenever the rendered state changes.

- payload: `protocolVersion`, `sdkVersion`, `mode`, `resumeId`, `showDownload`,
  `lockedTemplate` (`string | null`), `template`, `score`, `qualityScore`,
  `completenessScore`
- repeatable: yes
- a host that only needs one handshake can ignore repeats

### `heightChange`

- payload: `{ height: number }`, CSS pixels, finite and non-negative
- fires on render, on resize, and on any content change, coalesced to one
  message per animation frame
- repeatable: yes
- the SDK applies `height` only when `options.autoHeight` is not `false` and
  the value is greater than zero, and caps it at 10000px. It reports the height
  the frame is actually sized to, so `onHeightChange` never returns a value the
  frame does not have

### `validationChange`

- payload: `valid`, `score`, `qualityScore`, `completenessScore`, `errorCount`,
  `warningCount`, `issues`, `primaryGuidance`
- `issues` entries are `{ severity: 'error' | 'warning', section, code, message }`
- fires whenever validation result changes, including after `setResume`
- repeatable: yes

### `sectionFocus`

- payload: `{ section: string }`, the rendered heading text
- fires as the reader scrolls, once per section per document
- repeatable: no, by design: it reports where attention is, not a change

### `export`

- payload: `{ action: 'open-builder' | 'open-builder-edit', url, requestedFormat }`
- `requestedFormat` is the format a host asked for in `requestExport`, or `null`
  when the reader took the builder link themselves. Both triggers send the same
  shape, so a host can always tell which one it is looking at
- fires when the reader takes the download control, and in answer to
  `requestExport`
- repeatable: yes

### `error`

- payload: `code`, `message`, `fatal`
- `code` is one of `unsupported-protocol`, `resume-invalid`, `resume-too-large`,
  `command-failed`
- `fatal: true` means the bridge cannot continue and the host should stop
  sending commands
- fires when the embed refuses something the host asked for, or when it
  receives a message it cannot understand

## What the bridge actually checks

These are the protections that exist. This is not a claim that the SDK is
"secure"; it is a list of what is enforced and where.

On every inbound event, in [`sdk/renderer.ts`](../sdk/renderer.ts):

1. `event.source` is this instance's own `iframe.contentWindow`
2. `event.origin` equals the origin the frame was configured to load from
3. `source` is `cv-embed`
4. `version` equals `PROTOCOL_VERSION`
5. `embedId` matches this instance
6. the event name is in the allowlist
7. the payload parses against that event's schema

On every inbound command, in [`src/app/embed/EmbedPage.tsx`](../src/app/embed/EmbedPage.tsx):

1. `event.source` is `window.parent`
2. `event.origin` equals the configured parent origin
3. `source` is `cv-embed-host`
4. `version` equals `PROTOCOL_VERSION`
5. `embedId` matches this frame
6. the command name is in the allowlist
7. the payload parses against that command's schema
8. `setResume` additionally has to look like a resume before it replaces one

On the frame itself:

- `title` is set from `config.title`, so the frame is named rather than announced
  as an unlabelled iframe
- `referrerPolicy` is `strict-origin-when-cross-origin`, which keeps a host's full
  embed URL out of the frame's `Referer`
- `loading` is `lazy`, so an embed below the fold costs nothing to place
- the frame is granted **no** Permissions Policy features. The embed renders a
  read-only template and never touches the clipboard, so an earlier
  `allow="clipboard-write"` granted a cross-origin frame a capability nothing
  used. A feature is added at the same time as the call that needs it.

What this does **not** give you:

- The embed does not authenticate the host. Any page that embeds the frame is
  the host, and can send any valid command. There is no shared secret.
- The embedded view is read-only. It renders a template with no editing surface,
  so there is no per-section access control to configure, and no import control
  to disable. Earlier versions accepted `readOnlySections` and `disableImport`
  options that changed nothing; both are removed rather than shipped as
  decorative configuration.
- Resume content travels in the URL fragment, so the host already holds it.
  Anything you do not want the host to read, do not send to the embed.

## Testing

`tests/e2e/sdk-contract.spec.ts` drives the built `public/sdk.js` against the
real embed route. It covers the handshake, every host command, every event, and
the rejection paths: wrong window, wrong origin, wrong `embedId`, wrong source,
unknown names, bad payloads, foreign versions, oversized heights, commands sent
before the handshake, and a destroyed instance. Export coverage includes a
supported format, an unsupported one, a missing payload, and the correlation
between a host request and a reader click.

`tests/e2e/example-host.spec.ts` runs the published example end to end, so the
documentation cannot drift from working code.

`sdk/protocol.test.ts` covers the schemas directly, including every rejection
the contract promises. `sdk/artifact.test.ts` proves the build's own artifact
check rejects each way the bundle can silently lose its public surface.
