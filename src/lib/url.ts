const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:'])

export function getSafeExternalUrl(value: string): string {
  const candidate = value.trim()
  if (!candidate) return ''

  try {
    const url = new URL(candidate)
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol) || !url.hostname) return ''
    return candidate
  } catch {
    return ''
  }
}

export function isSafeExternalUrl(value: string): boolean {
  return getSafeExternalUrl(value).length > 0
}
