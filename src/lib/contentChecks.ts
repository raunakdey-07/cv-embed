import { DEFAULT_SECTION_ORDER, type Resume, type ResumeSectionKey } from '../types/resume'

// Shared "does this section have any usable content?" predicates used by the
// HTML templates (Minimal/Compact) and the PDF/DOCX renderers so every output
// format renders exactly the same sections.

export const hasText = (value: string): boolean => value.trim() !== ''

export function hasContent<T extends object>(items: T[]): boolean {
  return items.some((item) =>
    Object.values(item as Record<string, unknown>).some((value) =>
      Array.isArray(value)
        ? value.some((entry) => (typeof entry === 'string' ? entry.trim() !== '' : true))
        : typeof value === 'string'
          ? value.trim() !== ''
          : false,
    ),
  )
}

export function hasSkills(skills: Resume['skills']): boolean {
  return [...skills.languages, ...skills.frameworks, ...skills.tools, ...skills.other].some(hasText)
}

export const hasEducationItem = (item: Resume['education'][number]) =>
  [item.institution, item.degree, item.field, item.cgpa, item.startDate, item.endDate, item.location].some(hasText)

export const hasExperienceItem = (item: Resume['experience'][number]) =>
  [item.company, item.role, item.location, item.startDate, item.endDate].some(hasText) || item.bullets.some(hasText)

export const hasProjectItem = (item: Resume['projects'][number]) =>
  [item.title, item.projectLink, item.repoLink, item.startDate, item.endDate].some(hasText) ||
  item.techStack.length > 0 ||
  item.bullets.some(hasText)

export const hasCertificationItem = (item: Resume['certifications'][number]) =>
  [item.title, item.issuer, item.date, item.credentialId, item.credentialUrl].some(hasText)

export const hasAccomplishmentItem = (item: Resume['accomplishments'][number]) =>
  [item.title, item.organization, item.location, item.startDate, item.endDate].some(hasText) || item.bullets.some(hasText)

export const hasActivityItem = (item: Resume['activities'][number]) =>
  [item.role, item.organization, item.location, item.startDate, item.endDate, item.referenceUrl].some(hasText)

export const hasVolunteeringItem = (item: Resume['volunteering'][number]) =>
  [item.role, item.organization, item.location, item.startDate, item.endDate].some(hasText) || item.bullets.some(hasText)

export const hasPublicationItem = (item: Resume['publications'][number]) =>
  [item.title, item.venue, item.date, item.url].some(hasText)

export function getOrderedSectionIds(resume: Resume): ResumeSectionKey[] {
  return [...new Set([...resume.meta.documentOptions.sectionOrder, ...DEFAULT_SECTION_ORDER])]
}

export function isSectionVisible(resume: Resume, sectionId: ResumeSectionKey): boolean {
  return resume.meta.documentOptions.showSections[sectionId]
}

export function sectionHasContent(resume: Resume, sectionId: ResumeSectionKey): boolean {
  switch (sectionId) {
    case 'summary':
      return hasText(resume.basics.summary)
    case 'education':
      return resume.education.some(hasEducationItem)
    case 'experience':
      return resume.experience.some(hasExperienceItem)
    case 'projects':
      return resume.projects.some(hasProjectItem)
    case 'skills':
      return hasSkills(resume.skills)
    case 'certifications':
      return resume.certifications.some(hasCertificationItem)
    case 'accomplishments':
      return resume.accomplishments.some(hasAccomplishmentItem)
    case 'activities':
      return resume.activities.some(hasActivityItem)
    case 'volunteering':
      return resume.volunteering.some(hasVolunteeringItem)
    case 'publications':
      return resume.publications.some(hasPublicationItem)
  }
}

export function getRenderableSectionIds(resume: Resume): ResumeSectionKey[] {
  return getOrderedSectionIds(resume).filter((sectionId) =>
    isSectionVisible(resume, sectionId) && sectionHasContent(resume, sectionId),
  )
}
