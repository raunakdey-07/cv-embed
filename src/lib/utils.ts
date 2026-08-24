import { createDefaultDocumentOptions, createEmptyResume, DEFAULT_SECTION_ORDER, type Resume, type ResumeSectionKey } from '../types/resume'

export function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function toCommaList(items: string[]): string {
  return items.join(', ')
}

export function createResumeId(): string {
  const seed = crypto.getRandomValues(new Uint32Array(2))
  return `${seed[0].toString(36)}${seed[1].toString(36)}`.slice(0, 12)
}

export type DateStyle = 'range' | 'compact' | 'short' | 'numeric' | 'iso'

function formatDateToken(value: string, style: DateStyle = 'range'): string {
  const raw = value.trim()
  if (!raw) {
    return ''
  }

  const monthMatch = raw.match(/^(\d{4})-(\d{2})$/)
  if (monthMatch) {
    const [, year, month] = monthMatch
    const monthIndex = Number(month) - 1
    if (monthIndex >= 0 && monthIndex <= 11) {
      return formatMonthYear(Number(year), monthIndex, style)
    }
  }

  const dayMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dayMatch) {
    const [, year, month] = dayMatch
    const monthIndex = Number(month) - 1
    if (monthIndex >= 0 && monthIndex <= 11) {
      return formatMonthYear(Number(year), monthIndex, style)
    }
  }

  return raw
}

function formatMonthYear(year: number, monthIndex: number, style: DateStyle): string {
  const date = new Date(Date.UTC(year, monthIndex, 1))
  switch (style) {
    case 'short':
      return `${date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${year}`
    case 'numeric':
      return `${String(monthIndex + 1).padStart(2, '0')}/${year}`
    case 'iso':
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    default:
      return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
}

export function formatSingleDate(value: string, style: DateStyle = 'range'): string {
  return formatDateToken(value, style)
}

export function formatDateRangeByStyle(
  startDate: string,
  endDate: string,
  style: DateStyle,
): string {
  const start = formatDateToken(startDate, style)
  const end = formatDateToken(endDate, style)

  // ISO and numeric styles read fine with an en dash; others keep " - ".
  const separator = style === 'compact' || style === 'numeric' || style === 'iso' ? '–' : ' - '

  if (!start && !end) {
    return ''
  }

  if (!start && end) {
    return end
  }

  if (start && !end) {
    return `${start}${separator}Present`
  }

  return `${start}${separator}${end}`
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(base64 + padding)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function encodeResumeForUrl(resume: Resume): string {
  const json = JSON.stringify(resume)
  const bytes = new TextEncoder().encode(json)
  return bytesToBase64Url(bytes)
}

export function decodeResumeFromUrl(encoded: string): Resume | null {
  try {
    const bytes = base64UrlToBytes(encoded)
    const json = new TextDecoder().decode(bytes)
    return normalizeResume(JSON.parse(json) as Resume)
  } catch {
    return null
  }
}

export function normalizeResume(data: Resume): Resume {
  const base = createEmptyResume()
  const defaultOptions = createDefaultDocumentOptions()
  const incomingOrder = data.meta?.documentOptions?.sectionOrder ?? []
  const sanitizedOrder = incomingOrder.filter(
    (sectionId): sectionId is ResumeSectionKey => DEFAULT_SECTION_ORDER.includes(sectionId as ResumeSectionKey),
  )
  const mergedOrder = [
    ...new Set([...sanitizedOrder, ...DEFAULT_SECTION_ORDER]),
  ]

  const documentOptions = {
    ...defaultOptions,
    ...data.meta?.documentOptions,
    showSections: {
      ...defaultOptions.showSections,
      ...(data.meta?.documentOptions?.showSections ?? {}),
    },
    sectionOrder: mergedOrder,
  }

  return {
    ...base,
    ...data,
    meta: {
      ...base.meta,
      ...data.meta,
      documentOptions,
    },
    basics: {
      ...base.basics,
      ...data.basics,
      links: data.basics?.links ?? base.basics.links,
    },
    education: data.education ?? base.education,
    experience: data.experience ?? base.experience,
    projects: data.projects ?? base.projects,
    skills: {
      ...base.skills,
      ...data.skills,
    },
    certifications: data.certifications ?? base.certifications,
    accomplishments: data.accomplishments ?? base.accomplishments,
    activities: data.activities ?? base.activities,
    volunteering: data.volunteering ?? base.volunteering,
    publications: data.publications ?? base.publications,
  }
}
