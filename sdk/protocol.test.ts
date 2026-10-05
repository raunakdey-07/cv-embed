import { describe, expect, it } from 'vitest'
import {
  EMBED_EVENTS,
  EXPORT_FORMATS,
  HOST_COMMANDS,
  PROTOCOL_VERSION,
  SDK_VERSION,
  isUnsupportedProtocol,
  parseEmbedEvent,
  parseHostCommand,
  parseHostCommandName,
} from './protocol'

const embedId = 'cvembed_test'

const readyEvent = {
  source: 'cv-embed',
  version: PROTOCOL_VERSION,
  event: 'ready',
  embedId,
  payload: {
    protocolVersion: PROTOCOL_VERSION,
    sdkVersion: SDK_VERSION,
    mode: 'preview',
    resumeId: 'portable',
    showDownload: true,
    lockedTemplate: null,
    template: 'minimal',
    score: 70,
    qualityScore: 70,
    completenessScore: 70,
  },
}

describe('protocol versions', () => {
  it('keeps the SDK version and the wire protocol version distinct', () => {
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(PROTOCOL_VERSION).toBe('2')
  })

  it('declares every event and command exactly once', () => {
    expect(new Set(EMBED_EVENTS).size).toBe(EMBED_EVENTS.length)
    expect(new Set(HOST_COMMANDS).size).toBe(HOST_COMMANDS.length)
    expect(EMBED_EVENTS).toContain('error')
  })
})

describe('parseEmbedEvent', () => {
  it('accepts a well-formed event', () => {
    const parsed = parseEmbedEvent(readyEvent, embedId)
    expect(parsed?.event).toBe('ready')
    expect(parsed?.payload.mode).toBe('preview')
  })

  it('rejects an event addressed to another embed', () => {
    expect(parseEmbedEvent({ ...readyEvent, embedId: 'cvembed_other' }, embedId)).toBeNull()
  })

  it('rejects an unknown event name', () => {
    expect(parseEmbedEvent({ ...readyEvent, event: 'definitelyNotAnEvent' }, embedId)).toBeNull()
  })

  it('rejects the wrong source', () => {
    expect(parseEmbedEvent({ ...readyEvent, source: 'cv-embed-host' }, embedId)).toBeNull()
  })

  it('rejects an unsupported protocol version', () => {
    expect(parseEmbedEvent({ ...readyEvent, version: '1' }, embedId)).toBeNull()
    expect(parseEmbedEvent({ ...readyEvent, version: 2 }, embedId)).toBeNull()
  })

  it('rejects a payload missing required fields', () => {
    const payload = { ...readyEvent.payload } as Record<string, unknown>
    delete payload.mode
    expect(parseEmbedEvent({ ...readyEvent, payload }, embedId)).toBeNull()
  })

  it('rejects a payload with wrongly typed fields', () => {
    expect(parseEmbedEvent({ ...readyEvent, payload: { ...readyEvent.payload, score: 'high' } }, embedId)).toBeNull()
  })

  it('rejects a non-object payload for heightChange', () => {
    const base = { source: 'cv-embed', version: PROTOCOL_VERSION, embedId, event: 'heightChange' }
    expect(parseEmbedEvent({ ...base, payload: null }, embedId)).toBeNull()
    expect(parseEmbedEvent({ ...base, payload: { height: 'tall' } }, embedId)).toBeNull()
    expect(parseEmbedEvent({ ...base, payload: { height: Number.NaN } }, embedId)).toBeNull()
    expect(parseEmbedEvent({ ...base, payload: { height: -5 } }, embedId)).toBeNull()
    expect(parseEmbedEvent({ ...base, payload: { height: 420 } }, embedId)?.payload.height).toBe(420)
  })

  it('rejects non-message input', () => {
    for (const value of [null, undefined, 'ready', 42, [], () => {}]) {
      expect(parseEmbedEvent(value, embedId)).toBeNull()
    }
  })
})

describe('parseHostCommand', () => {
  const base = { source: 'cv-embed-host', version: PROTOCOL_VERSION, embedId }

  it('accepts every declared command with a valid payload', () => {
    const payloads = {
      syncState: {},
      setResume: { resume: { basics: {} } },
      focusSection: { section: 'Experience' },
      requestExport: { format: 'pdf' },
      setOptions: { primaryColor: '#ff0000', density: 'compact', showDownload: false },
    }
    for (const command of HOST_COMMANDS) {
      const parsed = parseHostCommand({ ...base, command, payload: payloads[command] }, embedId)
      expect(parsed?.command, command).toBe(command)
    }
  })

  it('rejects an unknown command', () => {
    expect(parseHostCommand({ ...base, command: 'dropDatabase', payload: {} }, embedId)).toBeNull()
  })

  it('rejects a command addressed to another embed', () => {
    expect(parseHostCommand({ ...base, embedId: 'cvembed_other', command: 'syncState', payload: {} }, embedId)).toBeNull()
  })

  it('rejects a payload that does not match the command schema', () => {
    expect(parseHostCommand({ ...base, command: 'focusSection', payload: {} }, embedId)).toBeNull()
    expect(parseHostCommand({ ...base, command: 'focusSection', payload: { section: '' } }, embedId)).toBeNull()
    expect(parseHostCommand({ ...base, command: 'requestExport', payload: { format: 'exe' } }, embedId)).toBeNull()
    expect(parseHostCommand({ ...base, command: 'setResume', payload: {} }, embedId)).toBeNull()
  })

  it('rejects an unsupported export format instead of defaulting it', () => {
    // Defaulting an unknown format would hand the host a PDF it never asked
    // for, which is the silent misreport this contract exists to prevent.
    expect(parseHostCommand({ ...base, command: 'requestExport', payload: { format: 'exe' } }, embedId)).toBeNull()
    expect(parseHostCommand({ ...base, command: 'requestExport', payload: { format: null } }, embedId)).toBeNull()
  })

  it('rejects the wrong source', () => {
    expect(parseHostCommand({ ...base, source: 'cv-embed', command: 'syncState', payload: {} }, embedId)).toBeNull()
  })

  it('rejects an unsupported protocol version', () => {
    expect(parseHostCommand({ ...base, version: '3', command: 'syncState', payload: {} }, embedId)).toBeNull()
  })

  it('rejects an embed-origin envelope sent to the command parser', () => {
    expect(parseHostCommand({ ...readyEvent }, embedId)).toBeNull()
  })
})

describe('parseHostCommandName', () => {
  const base = { source: 'cv-embed-host', version: PROTOCOL_VERSION, embedId }

  it('names a command whose payload the schema refused', () => {
    // The embed uses this to answer "your arguments were wrong" instead of
    // leaving the host waiting for an event that will never arrive.
    expect(parseHostCommandName({ ...base, command: 'requestExport', payload: { format: 'exe' } }, embedId)).toBe('requestExport')
  })

  it('names a well-formed command too', () => {
    expect(parseHostCommandName({ ...base, command: 'syncState', payload: {} }, embedId)).toBe('syncState')
  })

  it('does not name anything for a message that is not ours', () => {
    expect(parseHostCommandName({ ...base, command: 'dropDatabase', payload: {} }, embedId)).toBeNull()
    expect(parseHostCommandName({ ...base, embedId: 'cvembed_other', command: 'syncState', payload: {} }, embedId)).toBeNull()
    expect(parseHostCommandName({ ...base, source: 'cv-embed', command: 'syncState', payload: {} }, embedId)).toBeNull()
    expect(parseHostCommandName({ ...base, version: '9', command: 'syncState', payload: {} }, embedId)).toBeNull()
    expect(parseHostCommandName(null, embedId)).toBeNull()
  })
})

describe('export payload', () => {
  const base = { source: 'cv-embed', version: PROTOCOL_VERSION, embedId, event: 'export' }

  it('carries the route and the format the host asked for', () => {
    const parsed = parseEmbedEvent({ ...base, payload: { action: 'open-builder', url: 'https://example.test/builder', requestedFormat: 'docx' } }, embedId)
    expect(parsed?.payload).toEqual({ action: 'open-builder', url: 'https://example.test/builder', requestedFormat: 'docx' })
  })

  it('distinguishes a reader handoff from an answer to a host request', () => {
    // null requestedFormat means the reader took the link, not that the embed
    // ignored a request. Without it a host cannot correlate the two.
    const reader = parseEmbedEvent({ ...base, payload: { action: 'open-builder', url: '/builder', requestedFormat: null } }, embedId)
    expect(reader?.payload.requestedFormat).toBeNull()
  })

  it('rejects an action it cannot route to', () => {
    expect(parseEmbedEvent({ ...base, payload: { action: 'download-pdf' } }, embedId)).toBeNull()
    expect(parseEmbedEvent({ ...base, payload: { action: 'open-builder', requestedFormat: 'rtf' } }, embedId)).toBeNull()
  })

  it('accepts every format the protocol advertises', () => {
    for (const format of EXPORT_FORMATS) {
      const parsed = parseEmbedEvent({ ...base, payload: { action: 'open-builder', requestedFormat: format } }, embedId)
      expect(parsed?.payload.requestedFormat, format).toBe(format)
    }
  })
})

describe('isUnsupportedProtocol', () => {
  it('flags our own envelopes carrying a foreign version', () => {
    expect(isUnsupportedProtocol({ ...readyEvent, version: '1' })).toBe(true)
    expect(isUnsupportedProtocol({ source: 'cv-embed-host', version: '9', command: 'syncState', embedId, payload: {} })).toBe(true)
  })

  it('does not flag a matching version', () => {
    expect(isUnsupportedProtocol(readyEvent)).toBe(false)
  })

  it('does not flag unrelated traffic', () => {
    expect(isUnsupportedProtocol(null)).toBe(false)
    expect(isUnsupportedProtocol({ hello: 'world' })).toBe(false)
    expect(isUnsupportedProtocol({ source: 'react-devtools', version: '1' })).toBe(false)
  })
})
