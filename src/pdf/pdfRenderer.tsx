import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import { formatDateRangeByStyle, formatSingleDate } from '../lib/utils'
import { DEFAULT_SECTION_ORDER, type Resume, type ResumeSectionKey } from '../types/resume'

function getPdfStyleConfig(resume: Resume) {
  const options = resume.meta.documentOptions
  const fontFamily =
    options.fontFamily === 'times' || options.fontFamily === 'instrumentserif'
      ? 'Times-Roman'
      : 'Helvetica'
  const compactDensity = options.density === 'compact'
  const relaxedDensity = options.density === 'relaxed'
  const headerLineGap = compactDensity ? 0 : relaxedDensity ? 2 : 1
  const headingColor = options.accentColor || '#111111'
  const fontSize = options.fontSize === 'small' ? 9 : options.fontSize === 'large' ? 11 : 10
  const lineHeight = options.lineHeight === 'tight' ? 1.2 : options.lineHeight === 'relaxed' ? 1.6 : 1.4

  return StyleSheet.create({
    page: {
      padding: compactDensity ? 20 : relaxedDensity ? 28 : 24,
      fontSize,
      lineHeight,
      fontFamily,
    },
    header: {
      alignItems: 'center',
      textAlign: 'center',
    },
    name: {
      fontSize: options.fontSize === 'large' ? (compactDensity ? 19 : relaxedDensity ? 21 : 20) : (compactDensity ? 17 : relaxedDensity ? 19 : 18),
      marginBottom: 0,
      lineHeight: 1,
      fontWeight: 700,
      color: headingColor,
    },
    headline: {
      marginTop: headerLineGap,
      marginBottom: 0,
      lineHeight: 1.15,
      color: '#374151',
    },
    contact: {
      color: '#374151',
      marginTop: Math.max(0, headerLineGap - 1),
      marginBottom: 0,
      lineHeight: 1.15,
    },
    linksRow: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: headerLineGap,
    },
    linkItem: {
      color: headingColor,
      textDecoration: 'none',
    },
    section: {
      marginTop: compactDensity ? 10 : relaxedDensity ? 16 : 14,
      borderTop: 1,
      borderTopColor: '#e6e9f2',
      paddingTop: compactDensity ? 6 : relaxedDensity ? 10 : 8,
    },
    sectionTitle: {
      fontSize:
        options.sectionHeadingStyle === 'minimal'
          ? (options.fontSize === 'small' ? 9 : 10)
          : (options.fontSize === 'small' ? 10 : 11),
      fontWeight: 700,
      marginBottom: compactDensity ? 3 : relaxedDensity ? 5 : 4,
      textTransform: options.sectionHeadingStyle === 'minimal' ? 'none' : 'uppercase',
      color: headingColor,
      borderBottom: options.sectionHeadingStyle === 'rule' ? 1 : 0,
      borderBottomColor: options.sectionHeadingStyle === 'rule' ? '#dfe4ea' : undefined,
      paddingBottom: options.sectionHeadingStyle === 'rule' ? 2 : 0,
    },
    row: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowMeta: {
      color: '#4b5563',
    },
    item: {
      marginBottom: compactDensity ? 3 : relaxedDensity ? 5 : 4,
    },
    itemTitle: {
      fontWeight: 700,
    },
    bullet: {
      marginLeft: compactDensity ? 6 : relaxedDensity ? 10 : 8,
    },
    sectionText: {
      marginBottom: compactDensity ? 1 : relaxedDensity ? 3 : 2,
    },
  })
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
  [item.title, item.startDate, item.endDate, item.projectLink, item.repoLink].some(hasText) || item.techStack.length > 0 || item.bullets.some(hasText)

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

function ResumePdfDocument({ resume }: { resume: Resume }) {
  const options = resume.meta.documentOptions
  const styles = getPdfStyleConfig(resume)
  const bulletPrefix = options.bulletStyle === 'dash' ? '—' : '•'
  const dateValue = (startDate: string, endDate: string) => formatDateRangeByStyle(startDate, endDate, options.dateStyle)
  const linkValue = (label: string, url: string) => (options.linkDisplay === 'url' ? url : label || url)
  const hasHeadline = Boolean(resume.basics.headline)
  const sectionOrder = [...new Set([...(options.sectionOrder ?? []), ...DEFAULT_SECTION_ORDER])]

  const shouldRender = (sectionId: ResumeSectionKey, hasContentForSection: boolean) => {
    return options.showSections[sectionId] && hasContentForSection
  }

  const renderSection = (sectionId: ResumeSectionKey) => {
    switch (sectionId) {
      case 'summary':
        return shouldRender('summary', hasText(resume.basics.summary)) ? (
          <View style={styles.section} key="summary">
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text>{resume.basics.summary}</Text>
          </View>
        ) : null
      case 'education':
        return shouldRender('education', hasContent(resume.education)) ? (
          <View style={styles.section} key="education">
            <Text style={styles.sectionTitle}>Education</Text>
            {resume.education.filter(hasEducationItem).map((item, index) => (
              <View key={`education-${index}`} style={styles.item}>
                <View style={styles.row}>
                  <Text style={styles.itemTitle}>{item.institution}</Text>
                  <Text style={styles.rowMeta}>{dateValue(item.startDate, item.endDate)}</Text>
                </View>
                <Text>{[item.degree, item.field, item.cgpa ? `CGPA ${item.cgpa}` : ''].filter(Boolean).join(' • ')}</Text>
                {item.location ? <Text>{item.location}</Text> : null}
              </View>
            ))}
          </View>
        ) : null
      case 'experience':
        return shouldRender('experience', hasContent(resume.experience)) ? (
          <View style={styles.section} key="experience">
            <Text style={styles.sectionTitle}>Experience</Text>
            {resume.experience.filter(hasExperienceItem).map((item, index) => (
              <View key={`experience-${index}`} style={styles.item}>
                <View style={styles.row}>
                  <Text style={styles.itemTitle}>{item.role}{item.company ? `, ${item.company}` : ''}</Text>
                  <Text style={styles.rowMeta}>{dateValue(item.startDate, item.endDate)}</Text>
                </View>
                {item.location ? <Text>{item.location}</Text> : null}
                {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                  <Text key={`exp-bullet-${index}-${bulletIndex}`} style={styles.bullet}>{bulletPrefix} {bullet}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null
      case 'projects':
        return shouldRender('projects', hasContent(resume.projects)) ? (
          <View style={styles.section} key="projects">
            <Text style={styles.sectionTitle}>Projects</Text>
            {resume.projects.filter(hasProjectItem).map((item, index) => (
              <View key={`project-${index}`} style={styles.item}>
                <View style={styles.row}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>{dateValue(item.startDate, item.endDate)}</Text>
                </View>
                {item.techStack.length > 0 ? <Text>Tech: {item.techStack.join(', ')}</Text> : null}
                {item.projectLink ? <Text>Live: <Link src={item.projectLink}>{item.projectLink}</Link></Text> : null}
                {item.repoLink ? <Text>Repo: <Link src={item.repoLink}>{item.repoLink}</Link></Text> : null}
                {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                  <Text key={`proj-bullet-${index}-${bulletIndex}`} style={styles.bullet}>{bulletPrefix} {bullet}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null
      case 'skills':
        return shouldRender('skills', hasSkills(resume.skills)) ? (
          <View style={styles.section} key="skills">
            <Text style={styles.sectionTitle}>Skills</Text>
            {resume.skills.languages.length > 0 ? <Text style={styles.sectionText}>Languages: {resume.skills.languages.join(', ')}</Text> : null}
            {resume.skills.frameworks.length > 0 ? <Text style={styles.sectionText}>Frameworks: {resume.skills.frameworks.join(', ')}</Text> : null}
            {resume.skills.tools.length > 0 ? <Text style={styles.sectionText}>Tools: {resume.skills.tools.join(', ')}</Text> : null}
            {resume.skills.other.length > 0 ? <Text style={styles.sectionText}>Other: {resume.skills.other.join(', ')}</Text> : null}
          </View>
        ) : null
      case 'certifications':
        return shouldRender('certifications', hasContent(resume.certifications)) ? (
          <View style={styles.section} key="certifications">
            <Text style={styles.sectionTitle}>Certifications</Text>
            {resume.certifications.filter(hasCertificationItem).map((item, index) => {
              const date = formatSingleDate(item.date)
              const details = [
                item.credentialId ? `ID: ${item.credentialId}` : '',
                item.credentialUrl,
              ].filter(Boolean).join(' • ')
              return (
                <View key={`certification-${index}`}>
                  <Text style={styles.bullet}>{bulletPrefix} {item.title} - {item.issuer}{date ? ` (${date})` : ''}{details ? ` • ${details}` : ''}</Text>
                </View>
              )
            })}
          </View>
        ) : null
      case 'accomplishments':
        return shouldRender('accomplishments', hasContent(resume.accomplishments)) ? (
          <View style={styles.section} key="accomplishments">
            <Text style={styles.sectionTitle}>Accomplishments</Text>
            {resume.accomplishments.filter(hasAccomplishmentItem).map((item, index) => (
              <View key={`accomplishment-${index}`}>
                <View style={styles.row}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>{dateValue(item.startDate, item.endDate)}</Text>
                </View>
                <Text>{[item.organization, item.location].filter(Boolean).join(' • ')}</Text>
                {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                  <Text key={`ac-bullet-${index}-${bulletIndex}`} style={styles.bullet}>{bulletPrefix} {bullet}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null
      case 'activities':
        return shouldRender('activities', hasContent(resume.activities)) ? (
          <View style={styles.section} key="activities">
            <Text style={styles.sectionTitle}>Extra-curricular Activities</Text>
            {resume.activities.filter(hasActivityItem).map((item, index) => (
              <View key={`activity-${index}`}>
                <View style={styles.row}>
                  <Text style={styles.itemTitle}>{item.role}{item.organization ? `, ${item.organization}` : ''}</Text>
                  <Text style={styles.rowMeta}>{dateValue(item.startDate, item.endDate)}</Text>
                </View>
                {item.location ? <Text>{item.location}</Text> : null}
                {item.referenceUrl ? <Link src={item.referenceUrl}>Reference / Certificate</Link> : null}
              </View>
            ))}
          </View>
        ) : null
      case 'volunteering':
        return shouldRender('volunteering', hasContent(resume.volunteering)) ? (
          <View style={styles.section} key="volunteering">
            <Text style={styles.sectionTitle}>Volunteering</Text>
            {resume.volunteering.filter(hasVolunteeringItem).map((item, index) => (
              <View key={`volunteering-${index}`}>
                <View style={styles.row}>
                  <Text style={styles.itemTitle}>{item.role}{item.organization ? `, ${item.organization}` : ''}</Text>
                  <Text style={styles.rowMeta}>{dateValue(item.startDate, item.endDate)}</Text>
                </View>
                {item.location ? <Text>{item.location}</Text> : null}
                {item.bullets.filter(Boolean).map((bullet, bulletIndex) => (
                  <Text key={`vol-bullet-${index}-${bulletIndex}`} style={styles.bullet}>{bulletPrefix} {bullet}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null
      case 'publications':
        return shouldRender('publications', hasContent(resume.publications)) ? (
          <View style={styles.section} key="publications">
            <Text style={styles.sectionTitle}>Publications</Text>
            {resume.publications.filter(hasPublicationItem).map((item, index) => (
              <View key={`publication-${index}`}>
                <View style={styles.row}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>{formatSingleDate(item.date)}</Text>
                </View>
                {item.venue ? <Text>{item.venue}</Text> : null}
                {item.url ? <Link src={item.url}>{item.url}</Link> : null}
              </View>
            ))}
          </View>
        ) : null
      default:
        return null
    }
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{resume.basics.name || 'Your Name'}</Text>
          {resume.basics.headline ? <Text style={styles.headline}>{resume.basics.headline}</Text> : null}
          <Text style={hasHeadline ? styles.contact : [styles.contact, { marginTop: 0 }]}>{[resume.basics.email, resume.basics.phone, resume.basics.location].filter(Boolean).join(' • ')}</Text>
          <View style={styles.linksRow}>
            {resume.basics.links
              .filter((link) => !!link.url)
              .map((link, index) => (
                <Link key={`link-${index}`} src={link.url} style={styles.linkItem}>
                  {linkValue(link.label, link.url)}
                </Link>
              ))}
          </View>
        </View>

        {sectionOrder.map((sectionId) => renderSection(sectionId))}
      </Page>
    </Document>
  )
}

export async function countPdfPages(resume: Resume): Promise<number> {
  const blob = await pdf(<ResumePdfDocument resume={resume} />).toBlob()
  const text = await blob.text()
  const treeMatch = text.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/)
  if (treeMatch) return parseInt(treeMatch[1], 10)
  const pages = text.match(/\/Type\s*\/Page\b(?!s)/g)
  return pages ? pages.length : 1
}

export async function downloadResumePdf(resume: Resume, fileName: string): Promise<void> {
  const blob = await pdf(<ResumePdfDocument resume={resume} />).toBlob()
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}
