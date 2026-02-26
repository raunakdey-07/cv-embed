import type { CSSProperties } from 'react'
import { formatDateRangeByStyle, formatSingleDate } from '../../lib/utils'
import { DEFAULT_SECTION_ORDER, type Resume, type ResumeSectionKey } from '../../types/resume'

interface MinimalTemplateProps {
  resume: Resume
  primaryColor?: string
  densityMode?: 'comfortable' | 'compact' | 'relaxed'
}

function hasContent<T extends object>(items: T[]): boolean {
  return items.some((item) =>
    Object.values(item as Record<string, unknown>).some((v) =>
      Array.isArray(v) ? v.some((x) => typeof x === 'string' ? x.trim() !== '' : true) : typeof v === 'string' ? v.trim() !== '' : false,
    ),
  )
}

function hasSkills(s: Resume['skills']): boolean {
  return s.languages.length > 0 || s.frameworks.length > 0 || s.tools.length > 0 || s.other.length > 0
}

const hasText = (value: string) => value.trim() !== ''

const hasEducationItem = (item: Resume['education'][number]) =>
  [item.institution, item.degree, item.field, item.cgpa, item.startDate, item.endDate, item.location].some(hasText)

const hasExperienceItem = (item: Resume['experience'][number]) =>
  [item.company, item.role, item.location, item.startDate, item.endDate].some(hasText) || item.bullets.some(hasText)

const hasProjectItem = (item: Resume['projects'][number]) =>
  [item.title, item.projectLink, item.repoLink, item.startDate, item.endDate].some(hasText) || item.techStack.length > 0 || item.bullets.some(hasText)

const hasCertificationItem = (item: Resume['certifications'][number]) =>
  [item.title, item.issuer, item.date, item.credentialId, item.credentialUrl].some(hasText)

const hasAccomplishmentItem = (item: Resume['accomplishments'][number]) =>
  [item.title, item.organization, item.location, item.startDate, item.endDate].some(hasText) || item.bullets.some(hasText)

const hasActivityItem = (item: Resume['activities'][number]) =>
  [item.role, item.organization, item.location, item.startDate, item.endDate, item.referenceUrl].some(hasText)

const hasVolunteeringItem = (item: Resume['volunteering'][number]) =>
  [item.role, item.organization, item.location, item.startDate, item.endDate].some(hasText) || item.bullets.some(hasText)

const hasPublicationItem = (item: Resume['publications'][number]) =>
  [item.title, item.venue, item.date, item.url].some(hasText)

export function MinimalTemplate({ resume, primaryColor, densityMode = 'comfortable' }: MinimalTemplateProps) {
  const options = resume.meta.documentOptions
  const bulletPrefix = options.bulletStyle === 'dash' ? '—' : '•'

  const sectionClassName = `resume-template density-${densityMode} heading-${options.sectionHeadingStyle} font-${options.fontFamily} text-${options.fontSize} line-${options.lineHeight}`
  const sectionOrder = [...new Set([...(options.sectionOrder ?? []), ...DEFAULT_SECTION_ORDER])]

  const linkText = (label: string, url: string) => (options.linkDisplay === 'url' ? url : label || url)

  const shouldRender = (sectionId: ResumeSectionKey, hasContentForSection: boolean) => {
    return options.showSections[sectionId] && hasContentForSection
  }

  const renderSection = (sectionId: ResumeSectionKey) => {
    switch (sectionId) {
      case 'summary':
        return shouldRender('summary', hasText(resume.basics.summary)) ? (
          <section key="summary">
            <h2>Summary</h2>
            <p>{resume.basics.summary}</p>
          </section>
        ) : null
      case 'education':
        return shouldRender('education', hasContent(resume.education)) ? (
          <section key="education">
            <h2>Education</h2>
            {resume.education.filter(hasEducationItem).map((item, index) => (
              <div key={index} className="resume-row">
                <div>
                  <strong>{item.institution || 'Institution'}</strong>
                  <p>
                    {[item.degree, item.field].filter(Boolean).join(' • ')}
                    {item.cgpa ? ` • CGPA ${item.cgpa}` : ''}
                  </p>
                  {item.location ? <p>{item.location}</p> : null}
                </div>
                <div className="resume-row-meta">{formatDateRangeByStyle(item.startDate, item.endDate, options.dateStyle)}</div>
              </div>
            ))}
          </section>
        ) : null
      case 'experience':
        return shouldRender('experience', hasContent(resume.experience)) ? (
          <section key="experience">
            <h2>Experience</h2>
            {resume.experience.filter(hasExperienceItem).map((item, index) => (
              <div key={index} className="resume-item">
                <div className="resume-row">
                  <strong>
                    {item.role || 'Role'}{item.company ? `, ${item.company}` : ''}
                  </strong>
                  <div className="resume-row-meta">{formatDateRangeByStyle(item.startDate, item.endDate, options.dateStyle)}</div>
                </div>
                <p>{item.location}</p>
                <ul>
                  {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                    <li key={bulletIndex}>{bulletPrefix} {bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null
      case 'projects':
        return shouldRender('projects', hasContent(resume.projects)) ? (
          <section key="projects">
            <h2>Projects</h2>
            {resume.projects.filter(hasProjectItem).map((item, index) => (
              <div key={index} className="resume-item">
                <div className="resume-row">
                  <strong>{item.title || 'Project'}</strong>
                  <div className="resume-row-meta">{formatDateRangeByStyle(item.startDate, item.endDate, options.dateStyle)}</div>
                </div>
                {item.techStack.length > 0 ? <p>Tech: {item.techStack.join(', ')}</p> : null}
                {item.projectLink ? <p>Live: <a href={item.projectLink} target="_blank" rel="noreferrer">{item.projectLink}</a></p> : null}
                {item.repoLink ? <p>Repo: <a href={item.repoLink} target="_blank" rel="noreferrer">{item.repoLink}</a></p> : null}
                <ul>
                  {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                    <li key={bulletIndex}>{bulletPrefix} {bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null
      case 'skills':
        return shouldRender('skills', hasSkills(resume.skills)) ? (
          <section key="skills">
            <h2>Skills</h2>
            <div className="resume-skill-grid">
              {resume.skills.languages.length > 0 ? <p><strong>Languages:</strong> {resume.skills.languages.join(', ')}</p> : null}
              {resume.skills.frameworks.length > 0 ? <p><strong>Frameworks:</strong> {resume.skills.frameworks.join(', ')}</p> : null}
              {resume.skills.tools.length > 0 ? <p><strong>Tools:</strong> {resume.skills.tools.join(', ')}</p> : null}
              {resume.skills.other.length > 0 ? <p><strong>Other:</strong> {resume.skills.other.join(', ')}</p> : null}
            </div>
          </section>
        ) : null
      case 'certifications':
        return shouldRender('certifications', hasContent(resume.certifications)) ? (
          <section key="certifications">
            <h2>Certifications</h2>
            <ul>
              {resume.certifications.filter(hasCertificationItem).map((item, index) => (
                <li key={index}>
                  {bulletPrefix} {item.title} - {item.issuer}{formatSingleDate(item.date) ? ` (${formatSingleDate(item.date)})` : ''}
                  {item.credentialId ? ` • ID: ${item.credentialId}` : ''}
                  {item.credentialUrl ? ` • ${item.credentialUrl}` : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null
      case 'accomplishments':
        return shouldRender('accomplishments', hasContent(resume.accomplishments)) ? (
          <section key="accomplishments">
            <h2>Accomplishments</h2>
            {resume.accomplishments.filter(hasAccomplishmentItem).map((item, index) => (
              <div key={index} className="resume-item">
                <div className="resume-row">
                  <strong>{item.title || 'Accomplishment'}</strong>
                  <div className="resume-row-meta">{formatDateRangeByStyle(item.startDate, item.endDate, options.dateStyle)}</div>
                </div>
                <p>{[item.organization, item.location].filter(Boolean).join(' • ')}</p>
                <ul>
                  {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                    <li key={bulletIndex}>{bulletPrefix} {bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null
      case 'activities':
        return shouldRender('activities', hasContent(resume.activities)) ? (
          <section key="activities">
            <h2>Extra-curricular Activities</h2>
            {resume.activities.filter(hasActivityItem).map((item, index) => (
              <div key={index} className="resume-item">
                <div className="resume-row">
                  <strong>{item.role || 'Role'}{item.organization ? `, ${item.organization}` : ''}</strong>
                  <div className="resume-row-meta">{formatDateRangeByStyle(item.startDate, item.endDate, options.dateStyle)}</div>
                </div>
                <p>{item.location}</p>
                {item.referenceUrl ? (
                  <a href={item.referenceUrl} target="_blank" rel="noreferrer">
                    Reference / Certificate
                  </a>
                ) : null}
              </div>
            ))}
          </section>
        ) : null
      case 'volunteering':
        return shouldRender('volunteering', hasContent(resume.volunteering)) ? (
          <section key="volunteering">
            <h2>Volunteering</h2>
            {resume.volunteering.filter(hasVolunteeringItem).map((item, index) => (
              <div key={index} className="resume-item">
                <div className="resume-row">
                  <strong>{item.role || 'Role'}{item.organization ? `, ${item.organization}` : ''}</strong>
                  <div className="resume-row-meta">{formatDateRangeByStyle(item.startDate, item.endDate, options.dateStyle)}</div>
                </div>
                {item.location ? <p>{item.location}</p> : null}
                <ul>
                  {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                    <li key={bulletIndex}>{bulletPrefix} {bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null
      case 'publications':
        return shouldRender('publications', hasContent(resume.publications)) ? (
          <section key="publications">
            <h2>Publications</h2>
            {resume.publications.filter(hasPublicationItem).map((item, index) => (
              <div key={index} className="resume-item">
                <div className="resume-row">
                  <strong>{item.title || 'Publication'}</strong>
                  <div className="resume-row-meta">{formatSingleDate(item.date)}</div>
                </div>
                <p>{item.venue}</p>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
                ) : null}
              </div>
            ))}
          </section>
        ) : null
      default:
        return null
    }
  }

  return (
    <article className={sectionClassName} style={{ '--primary': primaryColor ?? options.accentColor } as CSSProperties}>
      <header className="resume-header">
        <h1>{resume.basics.name || 'Your Name'}</h1>
        {resume.basics.headline ? <p>{resume.basics.headline}</p> : null}
        <p>
          {[resume.basics.email, resume.basics.phone, resume.basics.location].filter(Boolean).join(' • ')}
        </p>
        <div className="link-row">
          {resume.basics.links
            .filter((link) => !!link.url)
            .map((link, index) => (
              <a href={link.url} target="_blank" rel="noreferrer" key={`${link.url}-${index}`}>
                {linkText(link.label, link.url)}
              </a>
            ))}
        </div>
      </header>

      {sectionOrder.map((sectionId) => renderSection(sectionId))}
    </article>
  )
}
