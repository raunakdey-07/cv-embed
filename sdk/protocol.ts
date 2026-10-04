import { z } from 'zod'

/**
 * CV-Embed bridge protocol.
 *
 * The wire format is two directional envelopes over `window.postMessage`:
 *
 *   embed -> host   { source: 'cv-embed',      version, event,    embedId, payload }
 *   host   -> embed { source: 'cv-embed-host', version, command, embedId, payload }
 *
 * `version` is the protocol version, not the SDK version. It is checked on
 * every message in both directions, so a host running an older SDK and a
 * frame running a newer protocol fail closed instead of half-working.
 *
 * Every inbound message is validated against these schemas before any handler
 * runs. Unknown event names, unknown commands, wrong `source`, wrong
 * `version`, a mismatched `embedId`, and payloads of the wrong shape are all
 * rejected without side effects.
 */

/** Wire protocol version. Bumped only for a breaking change to these schemas. */
export const PROTOCOL_VERSION = '2'

/** SDK package version, independent of the wire protocol. */
export const SDK_VERSION = '2.1.0'

export const EMBED_SOURCE = 'cv-embed'
export const HOST_SOURCE = 'cv-embed-host'

export const EMBED_EVENTS = [
  'ready',
  'heightChange',
  'validationChange',
  'sectionFocus',
  'export',
  'error',
] as const

export const HOST_COMMANDS = [
  'syncState',
  'setResume',
  'focusSection',
  'requestExport',
  'setOptions',
] as const

export type EmbedEventName = (typeof EMBED_EVENTS)[number]
export type HostCommandName = (typeof HOST_COMMANDS)[number]

const embedIdSchema = z.string().min(1)
const versionSchema = z.literal(PROTOCOL_VERSION)

/** Height is reported in CSS pixels and capped by the SDK before it is applied. */
const heightChangePayload = z.object({
  height: z.number().finite().nonnegative(),
})

const validationChangePayload = z.object({
  score: z.number().finite().nonnegative(),
  qualityScore: z.number().finite().nonnegative(),
  completenessScore: z.number().finite().nonnegative(),
  valid: z.boolean(),
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  issues: z.array(z.object({
    severity: z.enum(['error', 'warning']),
    section: z.string(),
    code: z.string(),
    message: z.string(),
  })),
  primaryGuidance: z.string(),
})

const sectionFocusPayload = z.object({ section: z.string() })

const exportPayload = z.object({
  action: z.enum(['open-builder', 'open-builder-edit']),
  url: z.string().optional(),
})

const readyPayload = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  sdkVersion: z.string(),
  mode: z.enum(['preview', 'guided', 'edit']),
  resumeId: z.string(),
  showDownload: z.boolean(),
  lockedTemplate: z.enum(['minimal', 'compact']).nullable(),
  template: z.enum(['minimal', 'compact']),
  score: z.number().finite().nonnegative(),
  qualityScore: z.number().finite().nonnegative(),
  completenessScore: z.number().finite().nonnegative(),
})

const errorPayload = z.object({
  code: z.enum([
    'invalid-message',
    'unsupported-protocol',
    'resume-invalid',
    'resume-too-large',
    'command-failed',
  ]),
  message: z.string(),
  fatal: z.boolean(),
})

export const embedEventPayloads = {
  ready: readyPayload,
  heightChange: heightChangePayload,
  validationChange: validationChangePayload,
  sectionFocus: sectionFocusPayload,
  export: exportPayload,
  error: errorPayload,
} as const

export const hostCommandPayloads = {
  /** Re-emits `ready` and `validationChange` so a late host can catch up. */
  syncState: z.object({}).loose(),
  /** The document is replaced wholesale; this is also how a host updates it. */
  // z.unknown() alone makes the key optional, so presence is required here:
  // a setResume with no document must be rejected, not normalized later.
  setResume: z.object({ resume: z.custom<unknown>((value) => value !== undefined) }),
  focusSection: z.object({ section: z.string().min(1) }),
  requestExport: z.object({
    format: z.enum(['pdf', 'docx', 'json']).default('pdf'),
  }),
  setOptions: z.object({
    primaryColor: z.string().nullable().optional(),
    density: z.enum(['comfortable', 'compact']).nullable().optional(),
    showDownload: z.boolean().optional(),
  }),
} as const

const embedEventEnvelope = z.object({
  source: z.literal(EMBED_SOURCE),
  version: versionSchema,
  event: z.enum(EMBED_EVENTS),
  embedId: embedIdSchema,
  payload: z.unknown(),
})

const hostCommandEnvelope = z.object({
  source: z.literal(HOST_SOURCE),
  version: versionSchema,
  command: z.enum(HOST_COMMANDS),
  embedId: embedIdSchema,
  payload: z.unknown(),
})

export interface HostCommandPayloadMap {
  syncState: Record<string, never>
  setResume: { resume: unknown }
  focusSection: { section: string }
  requestExport: { format: 'pdf' | 'docx' | 'json' }
  setOptions: { primaryColor?: string | null; density?: 'comfortable' | 'compact' | null; showDownload?: boolean }
}

export interface EmbedEvent {
  source: typeof EMBED_SOURCE
  version: typeof PROTOCOL_VERSION
  event: EmbedEventName
  embedId: string
  payload: Record<string, unknown>
}

/** Discriminated by `command`, so a switch narrows the payload type. */
export type HostCommand = {
  [K in HostCommandName]: {
    source: typeof HOST_SOURCE
    version: typeof PROTOCOL_VERSION
    command: K
    embedId: string
    payload: HostCommandPayloadMap[K]
  }
}[HostCommandName]

/**
 * Validates a message posted by an embedded frame. Returns null for anything
 * that is not a well-formed event for this protocol and this embed.
 */
export function parseEmbedEvent(data: unknown, embedId: string): EmbedEvent | null {
  const envelope = embedEventEnvelope.safeParse(data)
  if (!envelope.success) return null
  if (envelope.data.embedId !== embedId) return null

  const payload = embedEventPayloads[envelope.data.event].safeParse(envelope.data.payload)
  if (!payload.success) return null

  return {
    source: EMBED_SOURCE,
    version: PROTOCOL_VERSION,
    event: envelope.data.event,
    embedId: envelope.data.embedId,
    payload: payload.data as Record<string, unknown>,
  }
}

/**
 * Validates a message posted by a host into an embedded frame. Returns null
 * for anything that is not a well-formed command for this protocol.
 */
export function parseHostCommand(data: unknown, embedId: string): HostCommand | null {
  const envelope = hostCommandEnvelope.safeParse(data)
  if (!envelope.success) return null
  if (envelope.data.embedId !== embedId) return null

  const payload = hostCommandPayloads[envelope.data.command].safeParse(envelope.data.payload)
  if (!payload.success) return null

  // The schema above is the runtime guarantee; this cast only recovers the
  // per-command payload type that the schema encodes.
  return {
    source: HOST_SOURCE,
    version: PROTOCOL_VERSION,
    command: envelope.data.command,
    embedId: envelope.data.embedId,
    payload: payload.data,
  } as HostCommand
}

/**
 * True when a rejected message looks like ours but carries an unsupported
 * protocol version, so the peer can be told why it was refused.
 */
export function isUnsupportedProtocol(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const record = data as Record<string, unknown>
  const fromEmbed = record.source === EMBED_SOURCE && 'event' in record
  const fromHost = record.source === HOST_SOURCE && 'command' in record
  if (!fromEmbed && !fromHost) return false
  return typeof record.version === 'string' && record.version !== PROTOCOL_VERSION
}
