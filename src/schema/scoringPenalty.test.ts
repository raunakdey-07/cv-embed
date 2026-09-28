import { describe, expect, it } from 'vitest'
import { createEmptyResume, type Resume } from '../types/resume'
import { validateResume } from './validators'

function longBullet(): string {
  return 'Cut month-end close from 9 hours to 40 minutes, cut p95 API latency from 820ms to 190ms, cut infra spend by 18 percent, and mentored four engineers through the migration without any customer-visible downtime at all.'
}

function withBasics(resume: Resume): Resume {
  resume.basics.name = 'Representative User'
  resume.basics.email = 'representative@example.com'
  resume.basics.phone = '+1 555 0100'
  resume.basics.location = 'Berlin'
  resume.basics.links = [{ label: 'GitHub', url: 'https://github.com/example' }]
  return resume
}

function denseResume(): Resume {
  const resume = withBasics(createEmptyResume())
  resume.basics.summary = 'Platform engineer focused on reliability and measurable delivery outcomes.'
  resume.education = Array.from({ length: 4 }, (_, index) => ({
    institution: `University ${index}`,
    degree: 'BS',
    field: 'Computer Science',
    cgpa: '',
    startDate: '2012',
    endDate: '2016',
    location: 'Delhi',
  }))
  resume.experience = Array.from({ length: 6 }, (_, index) => ({
    company: `Company ${index}`,
    role: 'Engineer',
    location: 'Remote',
    startDate: '2016',
    endDate: '2024',
    bullets: Array.from({ length: 5 }, () => longBullet()),
  }))
  resume.projects = Array.from({ length: 5 }, (_, index) => ({
    title: `Project ${index}`,
    projectLink: 'https://example.com/project',
    repoLink: 'https://github.com/example/repo',
    techStack: ['TypeScript', 'React'],
    startDate: '2020',
    endDate: '2021',
    bullets: Array.from({ length: 4 }, () => longBullet()),
  }))
  resume.skills.languages = Array.from({ length: 10 }, (_, index) => `Lang${index}`)
  resume.skills.frameworks = Array.from({ length: 5 }, (_, index) => `Framework${index}`)
  resume.skills.tools = Array.from({ length: 5 }, (_, index) => `Tool${index}`)
  return resume
}

describe('warning penalty model', () => {
  it('does not let a long CV drive the quality score to zero', () => {
    const result = validateResume(denseResume())

    // 62 warnings across five distinct rules.
    expect(result.warnings.length).toBeGreaterThan(50)
    expect(result.completenessScore).toBe(100)
    // The previous per-instance model produced quality 0 and a final score of 50.
    expect(result.qualityScore).toBeGreaterThan(50)
    expect(result.score).toBeGreaterThan(75)
  })

  it('charges each distinct rule a bounded amount regardless of how often it fires', () => {
    const one = denseResume()
    one.experience = one.experience.slice(0, 1)
    const many = denseResume()
    many.experience = [...many.experience, ...many.experience, ...many.experience]

    const single = validateResume(one)
    const repeated = validateResume(many)
    // Twelve more entries trip the same two rules; the penalty must not scale.
    expect(repeated.warnings.length).toBeGreaterThan(single.warnings.length + 30)
    expect(repeated.qualityScore).toBeGreaterThanOrEqual(single.qualityScore - 12)
  })

  it('still penalises a CV that trips many different rules', () => {
    const messy = denseResume()
    messy.education = []
    messy.skills = { languages: ['Dup', 'Dup'], frameworks: [], tools: [], other: [] }
    messy.basics.links = [{ label: 'Site', url: 'not-a-url' }]

    const result = validateResume(messy)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.qualityScore).toBeLessThan(validateResume(denseResume()).qualityScore)
  })

  it('keeps a clean CV at full marks', () => {
    const clean = withBasics(createEmptyResume())
    clean.basics.summary = 'Platform engineer focused on reliability and measurable delivery outcomes.'
    clean.education = [{ institution: 'University', degree: 'BS', field: 'Computer Science', cgpa: '', startDate: '2012', endDate: '2016', location: 'Delhi' }]
    clean.experience = [{ company: 'Company', role: 'Engineer', location: 'Remote', startDate: '2016', endDate: '2024', bullets: ['Cut month-end close from 9 hours to 40 minutes.'] }]
    clean.skills.languages = ['TypeScript', 'Go', 'Python']
    clean.skills.frameworks = ['React']
    clean.skills.tools = ['Postgres']
    clean.skills.other = ['Kafka']

    const result = validateResume(clean)
    expect(result.warnings).toEqual([])
    expect(result.qualityScore).toBe(100)
    expect(result.score).toBe(100)
  })

  it('preserves the verified semantics for an empty and a basics-only CV', () => {
    const empty = validateResume(createEmptyResume())
    expect(empty.score).toBe(0)
    expect(empty.qualityScore).toBe(0)

    const basics = withBasics(createEmptyResume())
    const basicsResult = validateResume(basics)
    expect(basicsResult.score).toBe(41)
    expect(basicsResult.qualityScore).toBe(38)
  })
})
