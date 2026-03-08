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
  readOnlySections?: string[]
  lockedTemplate?: 'minimal' | 'compact'
  disableImport?: boolean
  disableDownload?: boolean
  eventTargetOrigin?: string
}

export interface CVEmbedEvents {
  onReady?: (payload: unknown) => void
  onHeightChange?: (payload: { height: number }) => void
  onValidationChange?: (payload: unknown) => void
  onExport?: (payload: unknown) => void
  onSectionFocus?: (payload: unknown) => void
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
  source: 'cv-embed'
  version: '2'
  event: 'ready' | 'heightChange' | 'validationChange' | 'export' | 'sectionFocus'
  embedId: string
  payload: Record<string, unknown>
}

export interface CVEmbedInstance {
  destroy: () => void
  update: (nextConfig: Partial<CVEmbedConfig>) => void
  getIframe: () => HTMLIFrameElement | null
  on: <K extends keyof CVEmbedEvents>(eventName: K, handler: NonNullable<CVEmbedEvents[K]>) => void
  off: <K extends keyof CVEmbedEvents>(eventName: K, handler?: NonNullable<CVEmbedEvents[K]>) => void
}

function encodeResumeData(resumeData: unknown): string {
  const json = JSON.stringify(resumeData)
  const bytes = new TextEncoder().encode(json)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
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

export function buildEmbedUrl(config: CVEmbedConfig, embedId?: string): string {
  const baseUrl = config.baseUrl ?? window.location.origin
  const resumePath = config.resumeId ?? 'portable'
  const url = new URL(`/embed/${resumePath}`, baseUrl)

  if (config.resumeData) {
    url.searchParams.set('data', encodeResumeData(config.resumeData))
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

  if (config.options?.readOnlySections && config.options.readOnlySections.length > 0) {
    url.searchParams.set('readOnlySections', config.options.readOnlySections.join(','))
  }

  if (config.options?.lockedTemplate) {
    url.searchParams.set('lockedTemplate', config.options.lockedTemplate)
  }

  if (config.options?.disableImport) {
    url.searchParams.set('disableImport', '1')
  }

  if (config.options?.eventTargetOrigin) {
    url.searchParams.set('eventOrigin', config.options.eventTargetOrigin)
  }

  if (typeof config.theme?.fontScale === 'number') {
    url.searchParams.set('fontScale', String(config.theme.fontScale))
  }

  if (typeof config.theme?.radius === 'number') {
    url.searchParams.set('radius', String(config.theme.radius))
  }

  url.searchParams.set('sdkVersion', '2')
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

  let activeConfig = { ...config }
  let listeners = mergeEvents(config.events)
  const embedId = randomEmbedId()

  const iframe = document.createElement('iframe')
  iframe.src = buildEmbedUrl(activeConfig, embedId)
  iframe.width = String(config.width ?? '100%')
  iframe.height = String(config.height ?? 1100)
  iframe.frameBorder = '0'
  iframe.style.border = '0'
  iframe.setAttribute('loading', 'lazy')
  iframe.setAttribute('title', config.title ?? 'Embedded CV-Embed Resume')
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'

  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) {
      return
    }

    const data = event.data as CVEmbedBridgeEvent | undefined
    if (!data || data.source !== 'cv-embed' || data.version !== '2' || data.embedId !== embedId) {
      return
    }

    listeners.onMessage?.(data)

    if (data.event === 'ready') listeners.onReady?.(data.payload)
    if (data.event === 'validationChange') listeners.onValidationChange?.(data.payload)
    if (data.event === 'sectionFocus') listeners.onSectionFocus?.(data.payload)
    if (data.event === 'export') listeners.onExport?.(data.payload)
    if (data.event === 'heightChange') {
      const nextHeight = Number(data.payload.height)
      if (activeConfig.options?.autoHeight !== false && Number.isFinite(nextHeight) && nextHeight > 0) {
        iframe.height = String(Math.round(nextHeight))
      }
      listeners.onHeightChange?.({ height: nextHeight })
    }
  }

  window.addEventListener('message', onMessage)

  target.innerHTML = ''
  target.appendChild(iframe)

  const destroy = () => {
    window.removeEventListener('message', onMessage)
    if (iframe.parentElement === target) {
      target.removeChild(iframe)
    }
  }

  const update = (nextConfig: Partial<CVEmbedConfig>) => {
    activeConfig = {
      ...activeConfig,
      ...nextConfig,
      theme: { ...(activeConfig.theme ?? {}), ...(nextConfig.theme ?? {}) },
      options: { ...(activeConfig.options ?? {}), ...(nextConfig.options ?? {}) },
      events: mergeEvents(activeConfig.events, nextConfig.events),
    }
    listeners = mergeEvents(listeners, nextConfig.events)
    iframe.src = buildEmbedUrl(activeConfig, embedId)

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

  return {
    destroy,
    update,
    getIframe: () => iframe,
    on,
    off,
  }
}
