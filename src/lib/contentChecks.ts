import type { Resume } from '../types/resume'

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
  return skills.languages.length > 0 || skills.frameworks.length > 0 || skills.tools.length > 0 || skills.other.length > 0
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
