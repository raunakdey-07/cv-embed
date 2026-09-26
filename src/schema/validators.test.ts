import { describe, expect, it } from 'vitest'
import { createEmptyResume, type Resume } from '../types/resume'
import { validateResume } from './validators'

function createStudentResume(): Resume {
  const resume = createEmptyResume()
  resume.basics.name = 'Student Name'
  resume.basics.email = 'student@example.com'
  resume.education = []
  resume.experience = []
  resume.projects = []
  resume.skills = { languages: ['Python'], frameworks: [], tools: [], other: [] }
  resume.meta.documentOptions.showSections.education = false
  resume.meta.documentOptions.showSections.experience = false
  resume.meta.documentOptions.showSections.projects = false
  resume.meta.documentOptions.showSections.skills = false
  return resume
}

describe('validateResume', () => {
  it('scores a genuinely empty CV as zero', () => {
    const result = validateResume(createEmptyResume())

    expect(result.qualityScore).toBe(0)
    expect(result.completenessScore).toBe(0)
    expect(result.score).toBe(0)
  })

  it('gives Basics-only content a partial score without completing sections', () => {
    const resume = createEmptyResume()
    resume.basics.name = 'Basics Only'
    resume.basics.email = 'basics@example.com'

    const result = validateResume(resume)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
    expect(result.completenessScore).toBeLessThan(100)
  })

  it('increases the score when a visible section has meaningful content', () => {
    const basicsOnly = createEmptyResume()
    basicsOnly.basics.name = 'Section User'
    basicsOnly.basics.email = 'section@example.com'
    const withEducation = structuredClone(basicsOnly)
    withEducation.education = [{ institution: 'School', degree: 'BS', field: 'CS', cgpa: '', startDate: '', endDate: '', location: '' }]

    const basicsResult = validateResume(basicsOnly)
    const educationResult = validateResume(withEducation)
    expect(educationResult.score).toBeGreaterThan(basicsResult.score)
  })

  it('does not treat hidden sections as missing content', () => {
    const resume = createEmptyResume()
    resume.basics.name = 'Focused User'
    resume.basics.email = 'focused@example.com'
    resume.meta.documentOptions.showSections.summary = false
    resume.meta.documentOptions.showSections.education = false
    resume.meta.documentOptions.showSections.experience = false
    resume.meta.documentOptions.showSections.projects = false
    resume.meta.documentOptions.showSections.skills = false

    const result = validateResume(resume)
    expect(result.warnings).toEqual([])
    expect(result.score).toBeGreaterThan(0)
  })

  it('does not change the score for meaningful content in an optional hidden section', () => {
    const visible = createEmptyResume()
    visible.basics.name = 'Visible User'
    visible.basics.email = 'visible@example.com'
    const hiddenContent = structuredClone(visible)
    hiddenContent.accomplishments = [{ title: 'Hidden award', organization: 'Org', location: '', startDate: '', endDate: '', bullets: [] }]

    expect(validateResume(hiddenContent).score).toBe(validateResume(visible).score)
  })

  it('does not require phone, education, projects, or three skills', () => {
    const result = validateResume(createStudentResume())

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('only evaluates visible sections for readiness issues', () => {
    const resume = createStudentResume()
    const result = validateResume(resume)

    expect(result.warnings.join(' ')).not.toContain('education[0]')
    expect(result.warnings.join(' ')).not.toContain('projects[0]')
  })

  it('warns about unsafe links without creating an active URL', () => {
    const resume = createEmptyResume()
    resume.basics.name = 'Link User'
    resume.basics.email = 'link@example.com'
    resume.basics.links = [{ label: 'Portfolio', url: 'javascript:alert(1)' }]

    const result = validateResume(resume)
    expect(result.warnings.some((warning) => warning.includes('basics.links[0].url'))).toBe(true)
  })

  it('returns a safe result for structurally invalid runtime data', () => {
    const result = validateResume({ education: {} } as unknown as Resume)

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.score).toBe(0)
  })
})
