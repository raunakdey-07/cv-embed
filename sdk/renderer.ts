export interface CVEmbedTheme {
  primaryColor?: string
  density?: 'normal' | 'compact'
}

export interface CVEmbedOptions {
  showDownload?: boolean
}

export interface CVEmbedConfig {
  resumeId?: string
  resumeData?: unknown
  target: string
  baseUrl?: string
  width?: string | number
  height?: string | number
  theme?: CVEmbedTheme
  options?: CVEmbedOptions
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

export function buildEmbedUrl(config: CVEmbedConfig): string {
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

  return url.toString()
}

export function renderEmbed(config: CVEmbedConfig): void {
  if (!config.resumeId && !config.resumeData) {
    throw new Error('resumeId or resumeData is required')
  }

  const target = document.querySelector(config.target)

  if (!target) {
    throw new Error(`Target not found: ${config.target}`)
  }

  const iframe = document.createElement('iframe')
  iframe.src = buildEmbedUrl(config)
  iframe.width = String(config.width ?? '100%')
  iframe.height = String(config.height ?? 1100)
  iframe.frameBorder = '0'
  iframe.style.border = '0'
  iframe.setAttribute('loading', 'lazy')

  target.innerHTML = ''
  target.appendChild(iframe)
}
