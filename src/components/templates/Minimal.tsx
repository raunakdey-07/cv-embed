import type { CSSProperties } from 'react'
import {
  hasAccomplishmentItem,
  hasActivityItem,
  hasCertificationItem,
  hasEducationItem,
  hasExperienceItem,
  hasProjectItem,
  hasPublicationItem,
  hasVolunteeringItem,
  getOrderedSectionIds,
  isSectionVisible,
  sectionHasContent,
} from '../../lib/contentChecks'
import { getSafeExternalUrl } from '../../lib/url'
import { formatDateRangeByStyle, formatSingleDate } from '../../lib/utils'
import type { Resume, ResumeSectionKey } from '../../types/resume'

interface MinimalTemplateProps {
  resume: Resume
  primaryColor?: string
  densityMode?: 'comfortable' | 'compact' | 'relaxed'
}

export function MinimalTemplate({ resume, primaryColor, densityMode = 'comfortable' }: MinimalTemplateProps) {
  const options = resume.meta.documentOptions
  const bulletPrefix = options.bulletStyle === 'dash' ? '—' : '•'

  const sectionClassName = `resume-template density-${densityMode} header-${options.headerAlignment ?? 'center'} heading-${options.sectionHeadingStyle} font-${options.fontFamily} text-${options.fontSize} line-${options.lineHeight}`
  const sectionOrder = getOrderedSectionIds(resume)

  const linkText = (label: string, url: string) => (options.linkDisplay === 'url' ? url : label || url)
  const singleDate = (value: string) => formatSingleDate(value, options.dateStyle)

  const shouldRender = (sectionId: ResumeSectionKey) => isSectionVisible(resume, sectionId) && sectionHasContent(resume, sectionId)

  const renderSection = (sectionId: ResumeSectionKey) => {
    switch (sectionId) {
      case 'summary':
        return shouldRender('summary') ? (
          <section key="summary">
            <h2>Summary</h2>
            <p>{resume.basics.summary}</p>
          </section>
        ) : null
      case 'education':
        return shouldRender('education') ? (
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
        return shouldRender('experience') ? (
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
      case 'projects':
        return shouldRender('projects') ? (
          <section key="projects">
            <h2>Projects</h2>
            {resume.projects.filter(hasProjectItem).map((item, index) => (
              <div key={index} className="resume-item">
                <div className="resume-row">
                  <strong>{item.title || 'Project'}</strong>
                  <div className="resume-row-meta">{formatDateRangeByStyle(item.startDate, item.endDate, options.dateStyle)}</div>
                </div>
                {item.techStack.length > 0 ? <p>Tech: {item.techStack.join(', ')}</p> : null}
                {item.projectLink ? <p>Live: {getSafeExternalUrl(item.projectLink) ? <a href={getSafeExternalUrl(item.projectLink)} target="_blank" rel="noreferrer">{item.projectLink}</a> : item.projectLink}</p> : null}
                {item.repoLink ? <p>Repo: {getSafeExternalUrl(item.repoLink) ? <a href={getSafeExternalUrl(item.repoLink)} target="_blank" rel="noreferrer">{item.repoLink}</a> : item.repoLink}</p> : null}
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
        return shouldRender('skills') ? (
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
        return shouldRender('certifications') ? (
          <section key="certifications">
            <h2>Certifications</h2>
            <ul>
              {resume.certifications.filter(hasCertificationItem).map((item, index) => (
                <li key={index}>
                  {bulletPrefix} {item.title} - {item.issuer}{singleDate(item.date) ? ` (${singleDate(item.date)})` : ''}
                  {item.credentialId ? ` • ID: ${item.credentialId}` : ''}
                  {item.credentialUrl ? ` • ${item.credentialUrl}` : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null
      case 'accomplishments':
        return shouldRender('accomplishments') ? (
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
        return shouldRender('activities') ? (
          <section key="activities">
            <h2>Extra-curricular Activities</h2>
            {resume.activities.filter(hasActivityItem).map((item, index) => (
              <div key={index} className="resume-item">
                <div className="resume-row">
                  <strong>{item.role || 'Role'}{item.organization ? `, ${item.organization}` : ''}</strong>
                  <div className="resume-row-meta">{formatDateRangeByStyle(item.startDate, item.endDate, options.dateStyle)}</div>
                </div>
                {item.location ? <p>{item.location}</p> : null}
                {item.referenceUrl ? (
                  getSafeExternalUrl(item.referenceUrl)
                    ? <a href={getSafeExternalUrl(item.referenceUrl)} target="_blank" rel="noreferrer">Reference / Certificate</a>
                    : <span>Reference / Certificate: {item.referenceUrl}</span>
                ) : null}
              </div>
            ))}
          </section>
        ) : null
      case 'volunteering':
        return shouldRender('volunteering') ? (
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
        return shouldRender('publications') ? (
          <section key="publications">
            <h2>Publications</h2>
            {resume.publications.filter(hasPublicationItem).map((item, index) => (
              <div key={index} className="resume-item">
                <div className="resume-row">
                  <strong>{item.title || 'Publication'}</strong>
                  <div className="resume-row-meta">{singleDate(item.date)}</div>
                </div>
                <p>{item.venue}</p>
                {item.url ? (
                  getSafeExternalUrl(item.url)
                    ? <a href={getSafeExternalUrl(item.url)} target="_blank" rel="noreferrer">{item.url}</a>
                    : <span>{item.url}</span>
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
        <h1>{resume.basics.name}</h1>
        {resume.basics.headline ? <p>{resume.basics.headline}</p> : null}
        <p>
          {[resume.basics.email, resume.basics.phone, resume.basics.location].filter(Boolean).join(' • ')}
        </p>
        <div className="link-row">
          {resume.basics.links.map((link, index) => {
            const safeUrl = getSafeExternalUrl(link.url)
            return safeUrl ? (
              <a href={safeUrl} target="_blank" rel="noreferrer" key={`${link.url}-${index}`}>
                {linkText(link.label, link.url)}
              </a>
            ) : null
          })}
        </div>
      </header>

      {sectionOrder.map((sectionId) => renderSection(sectionId))}
    </article>
  )
}
