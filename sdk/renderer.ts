import {
  EMBED_SOURCE,
  HOST_SOURCE,
  PROTOCOL_VERSION,
  SDK_VERSION,
  parseEmbedEvent,
  type EmbedEventName,
  type HostCommandName,
  type HostCommandPayloadMap,
} from './protocol'

export interface CVEmbedTheme {
  primaryColor?: string
  density?: 'normal' | 'compact'
  fontScale?: number
  radius?: number
}

export interface CVEmbedOptions {
  showDownload?: boolean
  autoHeight?: boolean
  debug?: boolean
  mode?: 'preview' | 'guided' | 'edit'
  lockedTemplate?: 'minimal' | 'compact'
  disableDownload?: boolean
  /** Origin that receives bridge events. Defaults to the host page origin. */
  eventTargetOrigin?: string
}

export interface CVEmbedErrorPayload {
  code: string
  message: string
  fatal: boolean
}

export interface CVEmbedEvents {
  onReady?: (payload: Record<string, unknown>) => void
  onHeightChange?: (payload: { height: number }) => void
  onValidationChange?: (payload: Record<string, unknown>) => void
  onSectionFocus?: (payload: { section: string }) => void
  onExport?: (payload: Record<string, unknown>) => void
  onError?: (payload: CVEmbedErrorPayload) => void
  /** Every validated protocol event, after schema validation, before dispatch. */
  onMessage?: (event: CVEmbedBridgeEvent) => void
}

export interface CVEmbedConfig {
  resumeId?: string
  resumeData?: unknown
  target: string | HTMLElement
  baseUrl?: string
  width?: string | number
  height?: string | number
  title?: string
  theme?: CVEmbedTheme
  options?: CVEmbedOptions
  events?: CVEmbedEvents
}

export interface CVEmbedBridgeEvent {
  source: typeof EMBED_SOURCE
  version: typeof PROTOCOL_VERSION
  event: EmbedEventName
  embedId: string
  payload: Record<string, unknown>
}

export type CVEmbedHostCommand = HostCommandName
/** Re-exported rather than restated, so the SDK and the schemas cannot disagree. */
export type CVEmbedHostCommandPayloads = HostCommandPayloadMap

export interface CVEmbedInstance {
  destroy: () => void
  update: (nextConfig: Partial<CVEmbedConfig>) => void
  getIframe: () => HTMLIFrameElement
  /** Sends a validated command to the embedded frame. */
  send: <T extends CVEmbedHostCommand>(command: T, payload: CVEmbedHostCommandPayloads[T]) => boolean
  isReady: () => boolean
  on: <K extends keyof CVEmbedEvents>(eventName: K, handler: NonNullable<CVEmbedEvents[K]>) => void
  off: <K extends keyof CVEmbedEvents>(eventName: K, handler?: NonNullable<CVEmbedEvents[K]>) => void
}

/** Hard ceiling on iframe height, matching the ceiling the embed reports. */
const MAX_IFRAME_HEIGHT = 10000

function encodeResumeData(resumeData: unknown): string {
  const json = JSON.stringify(resumeData)
  const bytes = new TextEncoder().encode(json)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const SDK_SCRIPT_ORIGIN = typeof document === 'undefined' ? null : (() => {
  const script = document.currentScript as HTMLScriptElement | null
  if (!script?.src) return null
  try {
    return new URL(script.src, window.location.href).origin
  } catch {
    return null
  }
})()

function getDefaultBaseUrl(): string {
  return SDK_SCRIPT_ORIGIN ?? window.location.origin
}

function resolveTarget(target: string | HTMLElement): HTMLElement | null {
  if (typeof target === 'string') {
    return document.querySelector(target)
  }
  return target
}

function randomEmbedId(): string {
  return `cvembed_${Math.random().toString(36).slice(2, 10)}`
}

function mergeEvents(left?: CVEmbedEvents, right?: CVEmbedEvents): CVEmbedEvents {
  return { ...(left ?? {}), ...(right ?? {}) }
}

const activeInstances = new WeakMap<HTMLElement, CVEmbedInstance>()

export function buildEmbedUrl(config: CVEmbedConfig, embedId?: string): string {
  const baseUrl = config.baseUrl ?? getDefaultBaseUrl()
  const resumePath = encodeURIComponent(config.resumeId ?? 'portable')
  const url = new URL(`/embed/${resumePath}`, baseUrl)

  if (config.resumeData) {
    const fragment = new URLSearchParams()
    fragment.set('data', encodeResumeData(config.resumeData))
    url.hash = fragment.toString()
  }

  if (config.theme?.primaryColor) {
    url.searchParams.set('primaryColor', config.theme.primaryColor)
  }

  if (config.theme?.density) {
    url.searchParams.set('density', config.theme.density)
  }

  if (config.options?.showDownload === false) {
    url.searchParams.set('showDownload', '0')
  }

  if (config.options?.disableDownload === true) {
    url.searchParams.set('disableDownload', '1')
  }

  if (config.options?.mode) {
    url.searchParams.set('mode', config.options.mode)
  }

  if (config.options?.debug) {
    url.searchParams.set('debug', '1')
  }

  if (config.options?.lockedTemplate) {
    url.searchParams.set('lockedTemplate', config.options.lockedTemplate)
  }

  url.searchParams.set('eventOrigin', config.options?.eventTargetOrigin ?? window.location.origin)

  if (typeof config.theme?.fontScale === 'number') {
    url.searchParams.set('fontScale', String(config.theme.fontScale))
  }

  if (typeof config.theme?.radius === 'number') {
    url.searchParams.set('radius', String(config.theme.radius))
  }

  url.searchParams.set('sdkVersion', SDK_VERSION)
  url.searchParams.set('protocolVersion', PROTOCOL_VERSION)
  if (embedId) {
    url.searchParams.set('embedId', embedId)
  }

  return url.toString()
}

export function renderEmbed(config: CVEmbedConfig): CVEmbedInstance {
  if (!config.resumeId && !config.resumeData) {
    throw new Error('resumeId or resumeData is required')
  }

  const target = resolveTarget(config.target)

  if (!target) {
    throw new Error(`Target not found: ${String(config.target)}`)
  }

  activeInstances.get(target)?.destroy()

  let activeConfig = { ...config }
  let listeners = mergeEvents(config.events)
  let ready = false
  const embedId = randomEmbedId()

  const iframe = document.createElement('iframe')
  const initialUrl = buildEmbedUrl(activeConfig, embedId)
  // Derived from a configuration that already built successfully, so the
  // message handler can never throw on a value the host supplied.
  let expectedOrigin = new URL(initialUrl).origin
  iframe.src = initialUrl
  iframe.width = String(config.width ?? '100%')
  iframe.height = String(config.height ?? 1100)
  iframe.frameBorder = '0'
  iframe.style.border = '0'
  iframe.setAttribute('loading', 'lazy')
  iframe.setAttribute('title', config.title ?? 'Embedded CV-Embed Resume')
  // Keeps the full URL out of the frame's Referer on cross-origin embeds.
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  iframe.setAttribute('allow', 'clipboard-write')

  const appliedHeight = () => Math.max(0, Math.min(MAX_IFRAME_HEIGHT, Math.round(Number(iframe.height) || 0)))

  const emitError = (code: string, message: string, fatal = false) => {
    listeners.onError?.({ code, message, fatal })
  }

  const onMessage = (event: MessageEvent) => {
    // Two independent checks: the message must come from this frame, and from
    // the origin the frame was configured to load from. A page that embeds or
    // is embedded elsewhere cannot satisfy both.
    if (event.source !== iframe.contentWindow || event.origin !== expectedOrigin) {
      return
    }

    const parsed = parseEmbedEvent(event.data, embedId)
    if (!parsed) {
      return
    }

    listeners.onMessage?.(parsed)

    switch (parsed.event) {
      case 'ready':
        ready = true
        listeners.onReady?.(parsed.payload)
        return
      case 'validationChange':
        listeners.onValidationChange?.(parsed.payload)
        return
      case 'sectionFocus':
        listeners.onSectionFocus?.({ section: String(parsed.payload.section) })
        return
      case 'export':
        listeners.onExport?.(parsed.payload)
        return
      case 'error':
        emitError(
          String(parsed.payload.code),
          String(parsed.payload.message),
          parsed.payload.fatal === true,
        )
        return
      case 'heightChange': {
        if (activeConfig.options?.autoHeight === false) {
          listeners.onHeightChange?.({ height: appliedHeight() })
          return
        }
        const height = Math.min(MAX_IFRAME_HEIGHT, Math.round(Number(parsed.payload.height)))
        if (height <= 0) {
          // Never collapse the frame; report what it is actually sized to.
          listeners.onHeightChange?.({ height: appliedHeight() })
          return
        }
        iframe.height = String(height)
        listeners.onHeightChange?.({ height })
        return
      }
    }
  }

  window.addEventListener('message', onMessage)

  target.replaceChildren(iframe)

  const destroy = () => {
    ready = false
    window.removeEventListener('message', onMessage)
    if (activeInstances.get(target) === instance) {
      activeInstances.delete(target)
    }
    if (iframe.parentElement === target) {
      target.removeChild(iframe)
    }
  }

  const send = <T extends CVEmbedHostCommand>(command: T, payload: CVEmbedHostCommandPayloads[T]): boolean => {
    const frame = iframe.contentWindow
    if (!frame) return false
    frame.postMessage(
      { source: HOST_SOURCE, version: PROTOCOL_VERSION, command, embedId, payload },
      expectedOrigin,
    )
    return true
  }

  const update = (nextConfig: Partial<CVEmbedConfig>) => {
    const merged: CVEmbedConfig = {
      ...activeConfig,
      ...nextConfig,
      theme: { ...(activeConfig.theme ?? {}), ...(nextConfig.theme ?? {}) },
      options: { ...(activeConfig.options ?? {}), ...(nextConfig.options ?? {}) },
      events: mergeEvents(activeConfig.events, nextConfig.events),
    }

    // Build before committing. buildEmbedUrl throws on a malformed baseUrl; if
    // the merged config were assigned first, the bad value would poison every
    // later message and the bridge would stay dead with no way to recover.
    const nextUrl = buildEmbedUrl(merged, embedId)

    activeConfig = merged
    expectedOrigin = new URL(nextUrl).origin
    listeners = mergeEvents(listeners, nextConfig.events)
    // A reload creates a new document that has not handshaken yet.
    if (iframe.src !== nextUrl) {
      ready = false
      iframe.src = nextUrl
    }

    if (typeof nextConfig.title !== 'undefined') {
      iframe.title = nextConfig.title
    }
    if (typeof nextConfig.width !== 'undefined') {
      iframe.width = String(nextConfig.width)
    }
    if (typeof nextConfig.height !== 'undefined') {
      iframe.height = String(nextConfig.height)
    }
  }

  const on = <K extends keyof CVEmbedEvents>(eventName: K, handler: NonNullable<CVEmbedEvents[K]>) => {
    listeners[eventName] = handler as CVEmbedEvents[K]
  }

  const off = <K extends keyof CVEmbedEvents>(eventName: K, handler?: NonNullable<CVEmbedEvents[K]>) => {
    if (!handler || listeners[eventName] === handler) {
      listeners[eventName] = undefined
    }
  }

  const instance: CVEmbedInstance = {
    destroy,
    update,
    send,
    isReady: () => ready,
    getIframe: () => iframe,
    on,
    off,
  }
  activeInstances.set(target, instance)
  return instance
}

export { EMBED_EVENTS, HOST_COMMANDS, PROTOCOL_VERSION, SDK_VERSION } from './protocol'
export type { EmbedEventName, HostCommandName } from './protocol'
