import { clampScore } from '../lib/scoring'
import { getSafeExternalUrl } from '../lib/url'
import type { Resume, ResumeSectionKey, ValidationResult } from '../types/resume'
import { resumeSchema } from './resumeSchema'

const MAX_EXPERIENCE_BULLETS = 4
const MAX_PROJECT_BULLETS = 3
const MAX_ACCOMPLISHMENT_BULLETS = 3
const MAX_VOLUNTEERING_BULLETS = 4
const MAX_BULLET_CHARS = 180

function isBlank(value: string): boolean {
  return value.trim().length === 0
}


function hasAnyText(values: string[]): boolean {
  return values.some((value) => !isBlank(value))
}

function isVisible(resume: Resume, section: ResumeSectionKey): boolean {
  return resume.meta.documentOptions.showSections[section]
}

function dedupeAndFindDuplicates(skills: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const skill of skills) {
    const normalized = skill.trim().toLowerCase()
    if (!normalized) continue
    if (seen.has(normalized)) duplicates.add(skill.trim())
    else seen.add(normalized)
  }

  return [...duplicates]
}

function validateUrlField(value: string, path: string, warnings: string[]): void {
  if (value && !getSafeExternalUrl(value)) {
    warnings.push(`${path} must be a complete http:// or https:// URL`)
  }
}

function calculateCompletenessScore(resume: Resume): number {
  const hasText = (value: string) => !isBlank(value)
  const uniqueSkills = [...new Set([
    ...resume.skills.languages,
    ...resume.skills.frameworks,
    ...resume.skills.tools,
    ...resume.skills.other,
  ].map((skill) => skill.trim().toLowerCase()).filter(Boolean))]
  const hasEducation = resume.education.some((item) => hasAnyText([
    item.institution,
    item.degree,
    item.field,
    item.cgpa,
    item.startDate,
    item.endDate,
    item.location,
  ]))
  const hasExperience = resume.experience.some((item) => hasAnyText([
    item.company,
    item.role,
    item.location,
    item.startDate,
    item.endDate,
    ...item.bullets,
  ]))
  const hasProjects = resume.projects.some((item) => hasAnyText([
    item.title,
    item.projectLink,
    item.repoLink,
    ...item.techStack,
    item.startDate,
    item.endDate,
    ...item.bullets,
  ]))

  const checks = [
    hasText(resume.basics.name),
    hasText(resume.basics.email) || hasText(resume.basics.phone),
    !isVisible(resume, 'summary') || hasText(resume.basics.summary),
    !isVisible(resume, 'education') || hasEducation,
    !isVisible(resume, 'experience') && !isVisible(resume, 'projects') || hasExperience || hasProjects,
    !isVisible(resume, 'skills') || uniqueSkills.length >= 3,
    resume.basics.links.some((link) => Boolean(getSafeExternalUrl(link.url))),
  ]

  return clampScore(Math.round((checks.filter(Boolean).length / checks.length) * 100))
}

function emptyResult(errors: string[], warnings: string[]): ValidationResult {
  return {
    valid: false,
    warnings,
    errors,
    qualityScore: 0,
    completenessScore: 0,
    score: 0,
  }
}

export function validateResume(resume: Resume): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const schemaResult = resumeSchema.safeParse(resume)
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      const path = issue.path.join('.')
      errors.push(`${path}: ${issue.message}`)
    }
    return emptyResult(errors, warnings)
  }

  if (isBlank(resume.basics.name)) {
    errors.push('basics.name is required')
  }
  if (isBlank(resume.basics.email) && isBlank(resume.basics.phone)) {
    errors.push('basics requires an email address or phone number')
  }
  if (!isBlank(resume.basics.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.basics.email.trim())) {
    warnings.push('basics.email should use a valid email address')
  }

  if (isVisible(resume, 'summary') && isBlank(resume.basics.summary)) {
    warnings.push('Adding a concise summary may improve profile strength')
  }

  if (isVisible(resume, 'education')) {
    const meaningfulEducation = resume.education.some((item) => hasAnyText([
      item.institution,
      item.degree,
      item.field,
      item.cgpa,
      item.startDate,
      item.endDate,
      item.location,
    ]))
    if (!meaningfulEducation) {
      warnings.push('Add at least one education entry or hide the Education section')
    }
    resume.education.forEach((item, index) => {
      if (isBlank(item.institution)) warnings.push(`education[${index}].institution will appear empty`)
      if (isBlank(item.degree)) warnings.push(`education[${index}].degree will appear empty`)
    })
  }

  if (isVisible(resume, 'experience')) {
    resume.experience.forEach((item, index) => {
      if (item.bullets.length > MAX_EXPERIENCE_BULLETS) {
        warnings.push(`experience[${index}] has more than ${MAX_EXPERIENCE_BULLETS} bullets`)
      }
      item.bullets.forEach((bullet, bulletIndex) => {
        if (bullet.length > MAX_BULLET_CHARS) {
          warnings.push(`experience[${index}].bullets[${bulletIndex}] is longer than ${MAX_BULLET_CHARS} characters`)
        }
      })
    })
  }

  if (isVisible(resume, 'projects')) {
    resume.projects.forEach((item, index) => {
      if (item.bullets.length > MAX_PROJECT_BULLETS) {
        warnings.push(`projects[${index}] has more than ${MAX_PROJECT_BULLETS} bullets`)
      }
      item.bullets.forEach((bullet, bulletIndex) => {
        if (bullet.length > MAX_BULLET_CHARS) {
          warnings.push(`projects[${index}].bullets[${bulletIndex}] is longer than ${MAX_BULLET_CHARS} characters`)
        }
      })
      validateUrlField(item.projectLink, `projects[${index}].projectLink`, warnings)
      validateUrlField(item.repoLink, `projects[${index}].repoLink`, warnings)
    })
  }

  if (isVisible(resume, 'experience') || isVisible(resume, 'projects')) {
    const hasExperience = resume.experience.some((item) => hasAnyText([
      item.company,
      item.role,
      item.location,
      item.startDate,
      item.endDate,
      ...item.bullets,
    ]))
    const hasProjects = resume.projects.some((item) => hasAnyText([
      item.title,
      item.projectLink,
      item.repoLink,
      ...item.techStack,
      item.startDate,
      item.endDate,
      ...item.bullets,
    ]))
    if (!hasExperience && !hasProjects) {
      warnings.push('Add at least one experience or project entry, or hide those sections')
    }
  }

  const allSkills = [
    ...resume.skills.languages,
    ...resume.skills.frameworks,
    ...resume.skills.tools,
    ...resume.skills.other,
  ]
  const uniqueSkills = [...new Set(allSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean))]
  const duplicateSkills = dedupeAndFindDuplicates(allSkills)
  if (duplicateSkills.length > 0) {
    warnings.push(`Duplicate skills detected: ${duplicateSkills.join(', ')}`)
  }
  if (isVisible(resume, 'skills') && uniqueSkills.length < 3) {
    warnings.push('Add at least 3 distinct skills for a more complete Skills section')
  }

  if (isVisible(resume, 'certifications')) {
    resume.certifications.forEach((item, index) => {
      validateUrlField(item.credentialUrl, `certifications[${index}].credentialUrl`, warnings)
    })
  }
  if (isVisible(resume, 'accomplishments')) {
    resume.accomplishments.forEach((item, index) => {
      if (item.bullets.length > MAX_ACCOMPLISHMENT_BULLETS) {
        warnings.push(`accomplishments[${index}] has more than ${MAX_ACCOMPLISHMENT_BULLETS} bullets`)
      }
      item.bullets.forEach((bullet, bulletIndex) => {
        if (bullet.length > MAX_BULLET_CHARS) {
          warnings.push(`accomplishments[${index}].bullets[${bulletIndex}] is longer than ${MAX_BULLET_CHARS} characters`)
        }
      })
    })
  }
  if (isVisible(resume, 'activities')) {
    resume.activities.forEach((item, index) => {
      validateUrlField(item.referenceUrl, `activities[${index}].referenceUrl`, warnings)
    })
  }
  if (isVisible(resume, 'volunteering')) {
    resume.volunteering.forEach((item, index) => {
      if (item.bullets.length > MAX_VOLUNTEERING_BULLETS) {
        warnings.push(`volunteering[${index}] has more than ${MAX_VOLUNTEERING_BULLETS} bullets`)
      }
      item.bullets.forEach((bullet, bulletIndex) => {
        if (bullet.length > MAX_BULLET_CHARS) {
          warnings.push(`volunteering[${index}].bullets[${bulletIndex}] is longer than ${MAX_BULLET_CHARS} characters`)
        }
      })
    })
  }
  if (isVisible(resume, 'publications')) {
    resume.publications.forEach((item, index) => {
      validateUrlField(item.url, `publications[${index}].url`, warnings)
    })
  }

  resume.basics.links.forEach((link, index) => {
    validateUrlField(link.url, `basics.links[${index}].url`, warnings)
  })

  const roughLength = JSON.stringify(resume).length
  if (roughLength > 6000) {
    warnings.push('Resume may be longer than one page. Check the PDF page estimate before export.')
  }

  // The rubric applies error/warning penalties to a content-bearing CV. The
  // completeness score is also the content coverage gate, so default sections
  // and formatting alone cannot produce a non-zero quality score.
  const completenessScore = calculateCompletenessScore(resume)
  const penaltyAdjustedQuality = clampScore(100 - errors.length * 15 - warnings.length * 3)
  const qualityScore = completenessScore === 0
    ? 0
    : clampScore(Math.round(penaltyAdjustedQuality * completenessScore / 100))
  const score = clampScore(Math.round((qualityScore + completenessScore) / 2))

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    qualityScore,
    completenessScore,
    score,
  }
}
