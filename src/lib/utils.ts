import { resumeSchema } from '../schema/resumeSchema'
import {
  createDefaultDocumentOptions,
  createEmptyResume,
  DEFAULT_SECTION_ORDER,
  type DocumentOptions,
  type Resume,
  type ResumeLink,
  type ResumeSectionKey,
  type TemplateName,
} from '../types/resume'

const MONTH_NAMES = new Map([
  ['jan', 0],
  ['feb', 1],
  ['mar', 2],
  ['apr', 3],
  ['may', 4],
  ['jun', 5],
  ['jul', 6],
  ['aug', 7],
  ['sep', 8],
  ['oct', 9],
  ['nov', 10],
  ['dec', 11],
])

export const MAX_PORTABLE_PAYLOAD_CHARS = 1_000_000

export class ResumeDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResumeDataError'
  }
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordValue(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new ResumeDataError(`${path} must be an object`)
  }
  return value
}

function stringValue(value: unknown, fallback: string, path: string): string {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'string') {
    throw new ResumeDataError(`${path} must be a string`)
  }
  return value
}

function stringArray(value: unknown, fallback: string[], path: string): string[] {
  if (value === undefined || value === null) return [...fallback]
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new ResumeDataError(`${path} must be an array of strings`)
  }
  return [...value]
}

function enumValue<T extends string>(value: unknown, fallback: T, allowed: readonly T[], path: string): T {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ResumeDataError(`${path} has an unsupported value`)
  }
  return value as T
}

function itemValue(value: unknown, path: string): UnknownRecord {
  return recordValue(value, path)
}

function normalizeLinks(value: unknown, fallback: ResumeLink[]): ResumeLink[] {
  if (value === undefined || value === null) return [...fallback]
  if (!Array.isArray(value)) {
    throw new ResumeDataError('basics.links must be an array')
  }
  return value.map((entry, index) => {
    const link = itemValue(entry, `basics.links[${index}]`)
    return {
      label: stringValue(link.label, '', `basics.links[${index}].label`),
      url: stringValue(link.url, '', `basics.links[${index}].url`),
    }
  })
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some((entry) => hasMeaningfulValue(entry))
  if (isRecord(value)) return Object.values(value).some((entry) => hasMeaningfulValue(entry))
  return false
}

function createInferredVisibility(data: UnknownRecord): Record<ResumeSectionKey, boolean> {
  const visibility = Object.fromEntries(
    DEFAULT_SECTION_ORDER.map((sectionId) => [sectionId, false]),
  ) as Record<ResumeSectionKey, boolean>
  const basics = isRecord(data.basics) ? data.basics : {}

  if (hasMeaningfulValue(basics.summary)) visibility.summary = true
  for (const sectionId of DEFAULT_SECTION_ORDER) {
    if (sectionId !== 'summary' && hasMeaningfulValue(data[sectionId])) {
      visibility[sectionId] = true
    }
  }

  return visibility
}

function normalizeDocumentOptions(value: unknown, data: UnknownRecord): DocumentOptions {
  const defaults = createDefaultDocumentOptions()
  const hasDocumentOptions = value !== undefined && value !== null
  const input = hasDocumentOptions ? recordValue(value, 'meta.documentOptions') : {}
  const hasExplicitVisibility = hasDocumentOptions && input.showSections !== undefined && input.showSections !== null
  const rawShowSections = hasExplicitVisibility
    ? recordValue(input.showSections, 'meta.documentOptions.showSections')
    : {}
  const showSections = hasExplicitVisibility
    ? Object.fromEntries(DEFAULT_SECTION_ORDER.map((sectionId) => [sectionId, false])) as Record<ResumeSectionKey, boolean>
    : createInferredVisibility(data)

  for (const key of DEFAULT_SECTION_ORDER) {
    if (!hasExplicitVisibility) continue
    const sectionValue = rawShowSections[key]
    if (sectionValue === undefined || sectionValue === null) continue
    if (typeof sectionValue !== 'boolean') {
      throw new ResumeDataError(`meta.documentOptions.showSections.${key} must be a boolean`)
    }
    showSections[key] = sectionValue
  }

  const rawOrder = input.sectionOrder
  const incomingOrder = Array.isArray(rawOrder)
    ? rawOrder.filter((value): value is ResumeSectionKey =>
        typeof value === 'string' && DEFAULT_SECTION_ORDER.includes(value as ResumeSectionKey),
      )
    : []

  if (rawOrder !== undefined && rawOrder !== null && !Array.isArray(rawOrder)) {
    throw new ResumeDataError('meta.documentOptions.sectionOrder must be an array')
  }

  const accentColor = stringValue(input.accentColor, defaults.accentColor, 'meta.documentOptions.accentColor')
  if (!/^#[0-9a-f]{6}$/i.test(accentColor)) {
    throw new ResumeDataError('meta.documentOptions.accentColor must be a six-digit hex color')
  }

  return {
    accentColor,
    fontFamily: enumValue(input.fontFamily, defaults.fontFamily, ['satoshi', 'clash', 'spacegrotesk', 'instrumentserif', 'inter', 'helvetica', 'times'], 'meta.documentOptions.fontFamily'),
    fontSize: enumValue(input.fontSize, defaults.fontSize, ['small', 'normal', 'large'], 'meta.documentOptions.fontSize'),
    lineHeight: enumValue(input.lineHeight, defaults.lineHeight, ['tight', 'normal', 'relaxed'], 'meta.documentOptions.lineHeight'),
    sectionHeadingStyle: enumValue(input.sectionHeadingStyle, defaults.sectionHeadingStyle, ['rule', 'bold', 'minimal'], 'meta.documentOptions.sectionHeadingStyle'),
    bulletStyle: enumValue(input.bulletStyle, defaults.bulletStyle, ['dot', 'dash'], 'meta.documentOptions.bulletStyle'),
    dateStyle: enumValue(input.dateStyle, defaults.dateStyle, ['range', 'compact', 'short', 'numeric', 'iso'], 'meta.documentOptions.dateStyle'),
    density: enumValue(input.density, defaults.density, ['comfortable', 'compact', 'relaxed'], 'meta.documentOptions.density'),
    linkDisplay: enumValue(input.linkDisplay, defaults.linkDisplay, ['label', 'url'], 'meta.documentOptions.linkDisplay'),
    headerAlignment: enumValue(input.headerAlignment, defaults.headerAlignment, ['center', 'left'], 'meta.documentOptions.headerAlignment'),
    showSections,
    sectionOrder: [...new Set([...incomingOrder, ...DEFAULT_SECTION_ORDER])],
  }
}

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

interface DateParts {
  year: number
  monthIndex: number
}

function parseDateParts(value: string): DateParts | null {
  const raw = value.trim()
  const yearMonth = raw.match(/^(\d{4})-(\d{2})$/)
  if (yearMonth) {
    const year = Number(yearMonth[1])
    const monthIndex = Number(yearMonth[2]) - 1
    return year >= 1 && monthIndex >= 0 && monthIndex <= 11 ? { year, monthIndex } : null
  }

  const yearMonthName = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/)
  if (yearMonthName) {
    const monthIndex = MONTH_NAMES.get(yearMonthName[1].slice(0, 3).toLowerCase())
    const year = Number(yearMonthName[2])
    return monthIndex !== undefined && year >= 1 ? { year, monthIndex } : null
  }

  const fullDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (fullDate) {
    const year = Number(fullDate[1])
    const monthIndex = Number(fullDate[2]) - 1
    const day = Number(fullDate[3])
    if (year < 1 || monthIndex < 0 || monthIndex > 11 || day < 1) return null
    const date = new Date(Date.UTC(year, monthIndex, day))
    return date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex && date.getUTCDate() === day
      ? { year, monthIndex }
      : null
  }

  return null
}

function formatDateToken(value: string, style: DateStyle = 'range'): string {
  const raw = value.trim()
  if (!raw) return ''

  const parts = parseDateParts(raw)
  if (!parts) return raw

  const { year, monthIndex } = parts
  const date = new Date(Date.UTC(year, monthIndex, 1))
  switch (style) {
    case 'short':
      return `${date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${String(year).slice(-2)}`
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
  const separator = style === 'compact' || style === 'numeric' || style === 'iso' ? '–' : ' - '

  if (!start && !end) return ''
  if (!start && end) return end
  if (start && !end) return `${start}${separator}Present`
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
  if (json.length > MAX_PORTABLE_PAYLOAD_CHARS) {
    throw new ResumeDataError('Resume data is too large for a portable link')
  }
  const bytes = new TextEncoder().encode(json)
  return bytesToBase64Url(bytes)
}

function addDataFragment(url: URL, encoded: string): void {
  const fragment = new URLSearchParams()
  fragment.set('data', encoded)
  url.hash = fragment.toString()
}

export function createPortableResumeUrl(origin: string, encoded: string, showDownload: boolean): string {
  const url = new URL('/embed/portable', origin)
  if (!showDownload) {
    url.searchParams.set('showDownload', '0')
  }
  addDataFragment(url, encoded)
  return url.toString()
}

export function createBuilderHandoffUrl(origin: string, encoded: string): string {
  const url = new URL('/builder', origin)
  addDataFragment(url, encoded)
  return url.toString()
}

export function getResumeDataFromUrl(url: URL): string | null {
  const fragmentData = new URLSearchParams(url.hash.replace(/^#/, '')).get('data')
  return fragmentData ?? url.searchParams.get('data')
}

export function decodeResumeFromUrl(encoded: string): Resume | null {
  try {
    if (encoded.length > MAX_PORTABLE_PAYLOAD_CHARS) return null
    const bytes = base64UrlToBytes(encoded)
    const json = new TextDecoder().decode(bytes)
    return normalizeResume(JSON.parse(json) as unknown)
  } catch {
    return null
  }
}

export function createDownloadFileName(name: string, extension: string): string {
  const base = name
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .split('')
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
    .trim()

  return `${base || 'resume'}.${extension.replace(/^\./, '')}`
}

export function withUpdatedTimestamp(resume: Resume, updatedAt = new Date().toISOString()): Resume {
  return {
    ...resume,
    meta: {
      ...resume.meta,
      updatedAt,
    },
  }
}

function normalizeArray<T>(value: unknown, fallback: T[], path: string, normalizeItem: (item: unknown, index: number) => T): T[] {
  if (value === undefined || value === null) return [...fallback]
  if (!Array.isArray(value)) {
    throw new ResumeDataError(`${path} must be an array`)
  }
  return value.map((item, index) => normalizeItem(item, index))
}

export function normalizeResume(data: unknown): Resume {
  if (!isRecord(data)) {
    throw new ResumeDataError('Resume data must be a JSON object')
  }

  const base = createEmptyResume()
  const meta = data.meta === undefined || data.meta === null ? {} : recordValue(data.meta, 'meta')
  const basics = data.basics === undefined || data.basics === null ? {} : recordValue(data.basics, 'basics')
  const skills = data.skills === undefined || data.skills === null ? {} : recordValue(data.skills, 'skills')

  const normalized: Resume = {
    meta: {
      version: enumValue(meta.version, base.meta.version, ['1.0'], 'meta.version'),
      template: enumValue<TemplateName>(meta.template, base.meta.template, ['minimal', 'compact'], 'meta.template'),
      createdAt: stringValue(meta.createdAt, base.meta.createdAt, 'meta.createdAt'),
      updatedAt: stringValue(meta.updatedAt, base.meta.updatedAt, 'meta.updatedAt'),
      documentOptions: normalizeDocumentOptions(meta.documentOptions, data),
    },
    basics: {
      name: stringValue(basics.name, base.basics.name, 'basics.name'),
      headline: stringValue(basics.headline, base.basics.headline, 'basics.headline'),
      email: stringValue(basics.email, base.basics.email, 'basics.email'),
      phone: stringValue(basics.phone, base.basics.phone, 'basics.phone'),
      location: stringValue(basics.location, base.basics.location, 'basics.location'),
      summary: stringValue(basics.summary, base.basics.summary, 'basics.summary'),
      links: normalizeLinks(basics.links, base.basics.links),
    },
    education: normalizeArray(data.education, base.education, 'education', (value, index) => {
      const item = itemValue(value, `education[${index}]`)
      return {
        institution: stringValue(item.institution, '', `education[${index}].institution`),
        degree: stringValue(item.degree, '', `education[${index}].degree`),
        field: stringValue(item.field, '', `education[${index}].field`),
        cgpa: stringValue(item.cgpa, '', `education[${index}].cgpa`),
        startDate: stringValue(item.startDate, '', `education[${index}].startDate`),
        endDate: stringValue(item.endDate, '', `education[${index}].endDate`),
        location: stringValue(item.location, '', `education[${index}].location`),
      }
    }),
    experience: normalizeArray(data.experience, base.experience, 'experience', (value, index) => {
      const item = itemValue(value, `experience[${index}]`)
      return {
        company: stringValue(item.company, '', `experience[${index}].company`),
        role: stringValue(item.role, '', `experience[${index}].role`),
        location: stringValue(item.location, '', `experience[${index}].location`),
        startDate: stringValue(item.startDate, '', `experience[${index}].startDate`),
        endDate: stringValue(item.endDate, '', `experience[${index}].endDate`),
        bullets: stringArray(item.bullets, [], `experience[${index}].bullets`),
      }
    }),
    projects: normalizeArray(data.projects, base.projects, 'projects', (value, index) => {
      const item = itemValue(value, `projects[${index}]`)
      return {
        title: stringValue(item.title, '', `projects[${index}].title`),
        projectLink: stringValue(item.projectLink, '', `projects[${index}].projectLink`),
        repoLink: stringValue(item.repoLink, '', `projects[${index}].repoLink`),
        techStack: stringArray(item.techStack, [], `projects[${index}].techStack`),
        startDate: stringValue(item.startDate, '', `projects[${index}].startDate`),
        endDate: stringValue(item.endDate, '', `projects[${index}].endDate`),
        bullets: stringArray(item.bullets, [], `projects[${index}].bullets`),
      }
    }),
    skills: {
      languages: stringArray(skills.languages, base.skills.languages, 'skills.languages'),
      frameworks: stringArray(skills.frameworks, base.skills.frameworks, 'skills.frameworks'),
      tools: stringArray(skills.tools, base.skills.tools, 'skills.tools'),
      other: stringArray(skills.other, base.skills.other, 'skills.other'),
    },
    certifications: normalizeArray(data.certifications, base.certifications, 'certifications', (value, index) => {
      const item = itemValue(value, `certifications[${index}]`)
      return {
        title: stringValue(item.title, '', `certifications[${index}].title`),
        issuer: stringValue(item.issuer, '', `certifications[${index}].issuer`),
        date: stringValue(item.date, '', `certifications[${index}].date`),
        credentialId: stringValue(item.credentialId, '', `certifications[${index}].credentialId`),
        credentialUrl: stringValue(item.credentialUrl, '', `certifications[${index}].credentialUrl`),
      }
    }),
    accomplishments: normalizeArray(data.accomplishments, base.accomplishments, 'accomplishments', (value, index) => {
      const item = itemValue(value, `accomplishments[${index}]`)
      return {
        title: stringValue(item.title, '', `accomplishments[${index}].title`),
        organization: stringValue(item.organization, '', `accomplishments[${index}].organization`),
        location: stringValue(item.location, '', `accomplishments[${index}].location`),
        startDate: stringValue(item.startDate, '', `accomplishments[${index}].startDate`),
        endDate: stringValue(item.endDate, '', `accomplishments[${index}].endDate`),
        bullets: stringArray(item.bullets, [], `accomplishments[${index}].bullets`),
      }
    }),
    activities: normalizeArray(data.activities, base.activities, 'activities', (value, index) => {
      const item = itemValue(value, `activities[${index}]`)
      return {
        role: stringValue(item.role, '', `activities[${index}].role`),
        organization: stringValue(item.organization, '', `activities[${index}].organization`),
        location: stringValue(item.location, '', `activities[${index}].location`),
        startDate: stringValue(item.startDate, '', `activities[${index}].startDate`),
        endDate: stringValue(item.endDate, '', `activities[${index}].endDate`),
        referenceUrl: stringValue(item.referenceUrl, '', `activities[${index}].referenceUrl`),
      }
    }),
    volunteering: normalizeArray(data.volunteering, base.volunteering, 'volunteering', (value, index) => {
      const item = itemValue(value, `volunteering[${index}]`)
      return {
        role: stringValue(item.role, '', `volunteering[${index}].role`),
        organization: stringValue(item.organization, '', `volunteering[${index}].organization`),
        location: stringValue(item.location, '', `volunteering[${index}].location`),
        startDate: stringValue(item.startDate, '', `volunteering[${index}].startDate`),
        endDate: stringValue(item.endDate, '', `volunteering[${index}].endDate`),
        bullets: stringArray(item.bullets, [], `volunteering[${index}].bullets`),
      }
    }),
    publications: normalizeArray(data.publications, base.publications, 'publications', (value, index) => {
      const item = itemValue(value, `publications[${index}]`)
      return {
        title: stringValue(item.title, '', `publications[${index}].title`),
        venue: stringValue(item.venue, '', `publications[${index}].venue`),
        date: stringValue(item.date, '', `publications[${index}].date`),
        url: stringValue(item.url, '', `publications[${index}].url`),
      }
    }),
  }

  return resumeSchema.parse(normalized)
}
