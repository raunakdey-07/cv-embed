import { describe, expect, it } from 'vitest'
import { createEmptyResume } from '../types/resume'
import { getOrderedSectionIds, getRenderableSectionIds, hasSkills, safePrimaryColor, sectionHasContent } from './contentChecks'

describe('safePrimaryColor', () => {
  it('accepts a plain hex colour', () => {
    expect(safePrimaryColor('#3b5bdb')).toBe('#3b5bdb')
    expect(safePrimaryColor('#FFFFFF')).toBe('#FFFFFF')
    expect(safePrimaryColor('  #3b5bdb  ')).toBe('#3b5bdb')
  })

  it('rejects anything else, so the accent falls back to the document', () => {
    // The embed reads this from its own query string, so a shared link must not
    // be able to set the heading colour to the white paper it is drawn on.
    for (const value of ['#fff', 'red', '#12345', '#1234567', 'rgb(1,2,3)', 'url(x)', '', '  ']) {
      expect(safePrimaryColor(value), value).toBeUndefined()
    }
    expect(safePrimaryColor(null)).toBeUndefined()
    expect(safePrimaryColor(undefined)).toBeUndefined()
  })
})

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
