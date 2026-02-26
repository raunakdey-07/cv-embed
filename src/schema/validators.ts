import { clampScore } from '../lib/scoring'
import type { Resume, ValidationResult } from '../types/resume'
import { resumeSchema } from './resumeSchema'

const MAX_EXPERIENCE_BULLETS = 4
const MAX_PROJECT_BULLETS = 3
const MAX_ACCOMPLISHMENT_BULLETS = 3
const MAX_VOLUNTEERING_BULLETS = 4
const MAX_BULLET_CHARS = 180

function isBlank(value: string): boolean {
  return value.trim().length === 0
}

function pushMissingField(errors: string[], section: string, field: string, value: string) {
  if (isBlank(value)) {
    errors.push(`${section}.${field} is required`)
  }
}

function hasAnyText(values: string[]): boolean {
  return values.some((value) => !isBlank(value))
}

function dedupeAndFindDuplicates(skills: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const skill of skills) {
    const normalized = skill.trim().toLowerCase()
    if (!normalized) {
      continue
    }

    if (seen.has(normalized)) {
      duplicates.add(skill.trim())
    } else {
      seen.add(normalized)
    }
  }

  return [...duplicates]
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
  }

  pushMissingField(errors, 'basics', 'name', resume.basics.name)
  pushMissingField(errors, 'basics', 'email', resume.basics.email)
  pushMissingField(errors, 'basics', 'phone', resume.basics.phone)

  if (resume.education.length === 0) {
    errors.push('education must contain at least one entry')
  }

  resume.education.forEach((item, index) => {
    pushMissingField(errors, `education[${index}]`, 'institution', item.institution)
    pushMissingField(errors, `education[${index}]`, 'degree', item.degree)
    pushMissingField(errors, `education[${index}]`, 'field', item.field)
  })

  resume.experience.forEach((item, index) => {
    if (item.bullets.length > MAX_EXPERIENCE_BULLETS) {
      errors.push(`experience[${index}] has more than ${MAX_EXPERIENCE_BULLETS} bullets`)
    }

    item.bullets.forEach((bullet, bulletIndex) => {
      if (bullet.length > MAX_BULLET_CHARS) {
        errors.push(
          `experience[${index}].bullets[${bulletIndex}] exceeds ${MAX_BULLET_CHARS} characters`,
        )
      }
    })
  })

  resume.projects.forEach((item, index) => {
    if (item.bullets.length > MAX_PROJECT_BULLETS) {
      errors.push(`projects[${index}] has more than ${MAX_PROJECT_BULLETS} bullets`)
    }

    item.bullets.forEach((bullet, bulletIndex) => {
      if (bullet.length > MAX_BULLET_CHARS) {
        errors.push(`projects[${index}].bullets[${bulletIndex}] exceeds ${MAX_BULLET_CHARS} characters`)
      }
    })

    if (item.projectLink && !item.projectLink.startsWith('http')) {
      warnings.push(`projects[${index}].projectLink should start with http or https`)
    }

    if (item.repoLink && !item.repoLink.startsWith('http')) {
      warnings.push(`projects[${index}].repoLink should start with http or https`)
    }
  })

  resume.certifications.forEach((item, index) => {
    if (item.credentialUrl && !item.credentialUrl.startsWith('http')) {
      warnings.push(`certifications[${index}].credentialUrl should start with http or https`)
    }
  })

  resume.accomplishments.forEach((item, index) => {
    if (item.bullets.length > MAX_ACCOMPLISHMENT_BULLETS) {
      errors.push(`accomplishments[${index}] has more than ${MAX_ACCOMPLISHMENT_BULLETS} bullets`)
    }

    item.bullets.forEach((bullet, bulletIndex) => {
      if (bullet.length > MAX_BULLET_CHARS) {
        errors.push(`accomplishments[${index}].bullets[${bulletIndex}] exceeds ${MAX_BULLET_CHARS} characters`)
      }
    })
  })

  resume.activities.forEach((item, index) => {
    if (item.referenceUrl && !item.referenceUrl.startsWith('http')) {
      warnings.push(`activities[${index}].referenceUrl should start with http or https`)
    }
  })

  resume.volunteering.forEach((item, index) => {
    if (item.bullets.length > MAX_VOLUNTEERING_BULLETS) {
      errors.push(`volunteering[${index}] has more than ${MAX_VOLUNTEERING_BULLETS} bullets`)
    }

    item.bullets.forEach((bullet, bulletIndex) => {
      if (bullet.length > MAX_BULLET_CHARS) {
        errors.push(`volunteering[${index}].bullets[${bulletIndex}] exceeds ${MAX_BULLET_CHARS} characters`)
      }
    })
  })

  resume.publications.forEach((item, index) => {
    if (item.url && !item.url.startsWith('http')) {
      warnings.push(`publications[${index}].url should start with http or https`)
    }
  })

  const meaningfulProjects = resume.projects.filter((item) =>
    hasAnyText([item.title, item.startDate, item.endDate, item.projectLink, item.repoLink]) ||
    item.techStack.some((tech) => !isBlank(tech)) ||
    item.bullets.some((bullet) => !isBlank(bullet)),
  )

  const meaningfulExperience = resume.experience.filter((item) =>
    hasAnyText([item.company, item.role, item.location, item.startDate, item.endDate]) ||
    item.bullets.some((bullet) => !isBlank(bullet)),
  )

  if (meaningfulProjects.length === 0) {
    errors.push('At least one project is required')
  } else if (meaningfulProjects.length === 1) {
    warnings.push('Adding a second project improves profile depth')
  }

  if (meaningfulExperience.length === 0) {
    warnings.push('Add at least one experience or internship entry')
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

  const roughLength = JSON.stringify(resume).length
  if (roughLength > 6000) {
    warnings.push('Resume may overflow one page. Reduce summary or bullet lengths.')
  }

  if (isBlank(resume.basics.summary)) {
    warnings.push('Adding a concise summary may improve profile strength.')
  }

  if (uniqueSkills.length < 3) {
    errors.push('Add at least 3 distinct skills')
  } else if (uniqueSkills.length < 6) {
    warnings.push('Add a few more skills to improve discoverability')
  }

  const hasSummary = !isBlank(resume.basics.summary)
  const hasAnyLink = resume.basics.links.some((link) => !isBlank(link.url))

  const errorPenalty = Math.min(errors.length * 10, 70)
  const warningPenalty = Math.min(warnings.length * 3, 24)
  const completenessBonus =
    (meaningfulProjects.length >= 2 ? 3 : 0) +
    (meaningfulExperience.length >= 1 ? 2 : 0) +
    (hasSummary ? 2 : 0) +
    (uniqueSkills.length >= 6 ? 2 : 0) +
    (hasAnyLink ? 1 : 0)

  const score = 100 - errorPenalty - warningPenalty + completenessBonus

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    score: clampScore(score),
  }
}
