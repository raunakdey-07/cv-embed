import { describe, expect, it } from 'vitest'
import { createEmptyResume } from '../types/resume'
import { getOrderedSectionIds, getRenderableSectionIds, hasSkills, sectionHasContent } from './contentChecks'

describe('resume section view model', () => {
  it('preserves configured order and appends missing known sections', () => {
    const resume = createEmptyResume()
    resume.meta.documentOptions.sectionOrder = ['skills', 'summary', 'education']

    expect(getOrderedSectionIds(resume).slice(0, 3)).toEqual(['skills', 'summary', 'education'])
    expect(getOrderedSectionIds(resume)).toHaveLength(10)
  })

  it('returns no renderable sections for an empty CV', () => {
    const resume = createEmptyResume()
    expect(getRenderableSectionIds(resume)).toEqual([])
  })

  it('applies visibility before content', () => {
    const resume = createEmptyResume()
    resume.basics.summary = 'Engineer with experience building reliable systems.'
    resume.education = [{ institution: 'School', degree: 'BS', field: 'CS', cgpa: '', startDate: '', endDate: '', location: '' }]
    resume.skills.languages = ['TypeScript', 'React', 'Node']

    expect(getRenderableSectionIds(resume)).toEqual(['summary', 'education', 'skills'])
    resume.meta.documentOptions.showSections.education = false
    expect(getRenderableSectionIds(resume)).toEqual(['summary', 'skills'])
    expect(sectionHasContent(resume, 'education')).toBe(true)
  })

  it('ignores blank skill entries', () => {
    const resume = createEmptyResume()
    resume.skills.languages = ['', '  ']
    expect(hasSkills(resume.skills)).toBe(false)
  })
})
