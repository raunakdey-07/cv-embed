import { describe, expect, it } from 'vitest'
import { createEmptyResume, type Resume } from '../types/resume'
import {
  createBuilderHandoffUrl,
  createDownloadFileName,
  createPortableResumeUrl,
  decodeResumeFromUrl,
  encodeResumeForUrl,
  formatDateRangeByStyle,
  formatSingleDate,
  getResumeDataFromUrl,
  normalizeResume,
  ResumeDataError,
  withUpdatedTimestamp,
} from './utils'

function createValidResume(): Resume {
  const resume = createEmptyResume()
  resume.basics.name = 'José 🚀'
  resume.basics.email = 'jose@example.com'
  resume.basics.phone = '+1 555 0100'
  resume.education[0] = {
    institution: 'Example University',
    degree: 'BS',
    field: 'Computer Science',
    cgpa: '',
    startDate: '2020-09',
    endDate: '2024-06',
    location: '',
  }
  resume.experience = [{
    company: 'Example Labs',
    role: 'Engineer',
    location: '',
    startDate: '2024-07',
    endDate: '',
    bullets: ['Improved reliability by 30%.'],
  }]
  resume.projects = [{
    title: 'Example',
    projectLink: 'https://example.com',
    repoLink: '',
    techStack: ['TypeScript'],
    startDate: '',
    endDate: '',
    bullets: ['Built a useful tool.'],
  }]
  resume.skills.languages = ['TypeScript', 'React', 'Node']
  return resume
}

describe('default resume state', () => {
  it('starts with five visible core sections and no fabricated entries', () => {
    const resume = createEmptyResume()
    const visible = resume.meta.documentOptions.showSections
    const core = ['summary', 'education', 'experience', 'projects', 'skills'] as const

    expect(resume.meta.documentOptions.sectionOrder.slice(0, 5)).toEqual([...core])
    expect(core.every((sectionId) => visible[sectionId])).toBe(true)
    expect(Object.entries(visible).filter(([, isVisible]) => isVisible)).toHaveLength(5)
    expect(resume.education).toEqual([])
    expect(resume.experience).toEqual([])
    expect(resume.projects).toEqual([])
    expect(resume.skills).toEqual({ languages: [], frameworks: [], tools: [], other: [] })
  })
})

describe('normalizeResume', () => {
  it('fills partial legacy document options without enabling unseen sections', () => {
    const normalized = normalizeResume({
      meta: { documentOptions: {} },
      basics: { name: 'Taylor' },
    })

    expect(normalized.meta.version).toBe('1.0')
    expect(normalized.meta.documentOptions.accentColor).toBe('#111111')
    expect(normalized.meta.documentOptions.sectionOrder).toHaveLength(10)
    expect(normalized.meta.documentOptions.showSections.summary).toBe(false)
    expect(normalized.meta.documentOptions.showSections.education).toBe(false)
    expect(normalized.basics.name).toBe('Taylor')
  })

  it('preserves an explicit imported visibility configuration', () => {
    const normalized = normalizeResume({
      meta: {
        documentOptions: {
          showSections: {
            summary: false,
            education: true,
            experience: false,
            projects: false,
            skills: false,
            certifications: false,
            accomplishments: false,
            activities: false,
            volunteering: false,
            publications: false,
          },
        },
      },
      basics: { name: 'Imported User' },
      education: [{ institution: 'Imported School', degree: 'BS', field: 'CS', cgpa: '', startDate: '', endDate: '', location: '' }],
    })

    expect(normalized.meta.documentOptions.showSections.summary).toBe(false)
    expect(normalized.meta.documentOptions.showSections.education).toBe(true)
    expect(normalized.meta.documentOptions.showSections.skills).toBe(false)
  })

  it('infers visibility for a legacy import from meaningful content', () => {
    const normalized = normalizeResume({
      basics: { name: 'Legacy User', summary: 'A focused summary.' },
      education: [{ institution: 'School', degree: 'BS', field: 'CS', cgpa: '', startDate: '', endDate: '', location: '' }],
    })

    expect(normalized.meta.documentOptions.showSections.summary).toBe(true)
    expect(normalized.meta.documentOptions.showSections.education).toBe(true)
    expect(normalized.meta.documentOptions.showSections.experience).toBe(false)
    expect(normalized.meta.documentOptions.showSections.skills).toBe(false)
  })

  it.each([
    { education: {} },
    { basics: { links: {} } },
    { experience: [{ bullets: 'not-an-array' }] },
    { meta: { documentOptions: { sectionOrder: 'wrong' } } },
    { meta: { documentOptions: { accentColor: 'red' } } },
    [],
  ])('rejects malformed input without returning partial state', (value) => {
    expect(() => normalizeResume(value)).toThrow(ResumeDataError)
  })
})

describe('portable resume data', () => {
  it('round-trips Unicode resume data', () => {
    const resume = createValidResume()
    const decoded = decodeResumeFromUrl(encodeResumeForUrl(resume))

    expect(decoded?.basics.name).toBe('José 🚀')
    expect(decoded?.education[0].institution).toBe('Example University')
  })

  it('returns null for invalid encoded data', () => {
    expect(decodeResumeFromUrl('not-valid-base64')).toBeNull()
  })

  it('keeps generated resume data out of the HTTP request target', () => {
    const encoded = encodeResumeForUrl(createValidResume())
    const portable = createPortableResumeUrl('https://example.com', encoded, false)
    const url = new URL(portable)

    expect(url.search).toBe('?showDownload=0')
    expect(url.hash).toContain('data=')
    expect(getResumeDataFromUrl(url)).toBe(encoded)
  })

  it('keeps reading legacy query payloads', () => {
    const encoded = encodeResumeForUrl(createValidResume())
    const legacy = new URL('https://example.com/embed/portable')
    legacy.searchParams.set('data', encoded)

    expect(getResumeDataFromUrl(legacy)).toBe(encoded)
  })

  it('creates a builder handoff URL with the same encoded resume', () => {
    const encoded = encodeResumeForUrl(createValidResume())
    const handoff = new URL(createBuilderHandoffUrl('https://example.com', encoded))

    expect(handoff.pathname).toBe('/builder')
    expect(getResumeDataFromUrl(handoff)).toBe(encoded)
  })

  it('updates the timestamp without mutating the source', () => {
    const resume = createValidResume()
    const updated = withUpdatedTimestamp(resume, '2026-01-01T00:00:00.000Z')

    expect(updated.meta.updatedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(resume.meta.updatedAt).not.toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('download filenames', () => {
  it('removes path characters and bounds the base name', () => {
    const name = createDownloadFileName('  A/B:very long name '.repeat(12), 'pdf')
    expect(name.endsWith('.pdf')).toBe(true)
    expect(name).not.toContain('/')
    expect(name).not.toContain(':')
    expect(name.length).toBeLessThanOrEqual(85)
  })

  it('uses a readable fallback for an empty name', () => {
    expect(createDownloadFileName('   ', 'docx')).toBe('resume.docx')
  })
})

describe('date formatting', () => {
  it('formats the advertised month-name input', () => {
    expect(formatSingleDate('Sep 2024')).toBe('Sep 2024')
  })

  it('keeps invalid calendar dates visible for correction', () => {
    expect(formatSingleDate('2024-02-31')).toBe('2024-02-31')
  })

  it('formats short ranges with two-digit years', () => {
    expect(formatDateRangeByStyle('2024-06', '2025-08', 'short')).toBe('Jun 24 - Aug 25')
  })
})
