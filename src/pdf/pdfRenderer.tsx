import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import {
  hasAccomplishmentItem,
  hasActivityItem,
  hasCertificationItem,
  hasContent,
  hasEducationItem,
  hasExperienceItem,
  hasProjectItem,
  hasPublicationItem,
  hasSkills,
  hasText,
  hasVolunteeringItem,
} from '../lib/contentChecks'
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
  // Gap between header rows (headline → contact → links), matching CSS p margin
  const headerLineGap = compactDensity ? 2 : relaxedDensity ? 4 : 3
  // Below-name spacing: replaces the h1 line-height leading (5.6px comfortable, 4.8px compact, 6px relaxed)
  // that CSS adds automatically but react-pdf omits for single-line Text
  const nameBottomGap = compactDensity ? 5 : relaxedDensity ? 8 : 6
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
      marginBottom: nameBottomGap,
      fontWeight: 700,
      color: headingColor,
    },
    headline: {
      marginTop: headerLineGap,
      marginBottom: 0,
      color: '#374151',
    },
    contact: {
      color: '#374151',
      marginTop: headerLineGap,
      marginBottom: 0,
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

function ResumePdfDocument({ resume }: { resume: Resume }) {
  const options = resume.meta.documentOptions
  const styles = getPdfStyleConfig(resume)
  const bulletPrefix = options.bulletStyle === 'dash' ? '—' : '•'
  const dateValue = (startDate: string, endDate: string) => formatDateRangeByStyle(startDate, endDate, options.dateStyle)
  const linkValue = (label: string, url: string) => (options.linkDisplay === 'url' ? url : label || url)
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
          <Text style={styles.contact}>{[resume.basics.email, resume.basics.phone, resume.basics.location].filter(Boolean).join(' • ')}</Text>
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

async function renderResumePdfBlob(resume: Resume): Promise<Blob> {
  return pdf(<ResumePdfDocument resume={resume} />).toBlob()
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1))
  return sorted[index]
}

export interface PdfBenchmarkStats {
  engine: 'react-pdf' | 'chromium' | 'remote'
  iterations: number
  minMs: number
  maxMs: number
  avgMs: number
  p50Ms: number
  p95Ms: number
  avgSizeKb: number
  avgHeadingCoveragePct: number
  samplesMs: number[]
}

export interface PdfEngineComparison {
  local: PdfBenchmarkStats
  remote?: PdfBenchmarkStats
  deltaAvgMs?: number
  deltaP50Ms?: number
}

function expectedSectionHeadings(resume: Resume): string[] {
  const options = resume.meta.documentOptions
  const headings: string[] = []

  if (options.showSections.summary && hasText(resume.basics.summary)) headings.push('Summary')
  if (options.showSections.education && hasContent(resume.education)) headings.push('Education')
  if (options.showSections.experience && hasContent(resume.experience)) headings.push('Experience')
  if (options.showSections.projects && hasContent(resume.projects)) headings.push('Projects')
  if (options.showSections.skills && hasSkills(resume.skills)) headings.push('Skills')
  if (options.showSections.certifications && hasContent(resume.certifications)) headings.push('Certifications')
  if (options.showSections.accomplishments && hasContent(resume.accomplishments)) headings.push('Accomplishments')
  if (options.showSections.activities && hasContent(resume.activities)) headings.push('Extra-curricular Activities')
  if (options.showSections.volunteering && hasContent(resume.volunteering)) headings.push('Volunteering')
  if (options.showSections.publications && hasContent(resume.publications)) headings.push('Publications')

  return headings
}

export async function benchmarkReactPdfEngine(resume: Resume, iterations = 3): Promise<PdfBenchmarkStats> {
  const runs = Math.max(1, Math.min(12, Math.floor(iterations)))
  const samplesMs: number[] = []
  const sizesKb: number[] = []
  const headingCoveragePct: number[] = []
  const expectedHeadings = expectedSectionHeadings(resume)

  for (let index = 0; index < runs; index += 1) {
    const start = performance.now()
    const blob = await renderResumePdfBlob(resume)
    const end = performance.now()
    samplesMs.push(Math.max(0, Math.round(end - start)))
    sizesKb.push(blob.size / 1024)

    const text = await blob.text()
    if (expectedHeadings.length === 0) {
      headingCoveragePct.push(100)
    } else {
      const matched = expectedHeadings.filter((heading) => text.includes(heading)).length
      headingCoveragePct.push(Math.round((matched / expectedHeadings.length) * 100))
    }
  }

  const totalMs = samplesMs.reduce((sum, value) => sum + value, 0)
  const totalKb = sizesKb.reduce((sum, value) => sum + value, 0)
  const totalCoverage = headingCoveragePct.reduce((sum, value) => sum + value, 0)

  return {
    engine: 'react-pdf',
    iterations: runs,
    minMs: samplesMs.length > 0 ? Math.min(...samplesMs) : 0,
    maxMs: samplesMs.length > 0 ? Math.max(...samplesMs) : 0,
    avgMs: runs > 0 ? Math.round(totalMs / runs) : 0,
    p50Ms: Math.round(percentile(samplesMs, 50)),
    p95Ms: Math.round(percentile(samplesMs, 95)),
    avgSizeKb: runs > 0 ? totalKb / runs : 0,
    avgHeadingCoveragePct: runs > 0 ? totalCoverage / runs : 0,
    samplesMs,
  }
}

export async function benchmarkRemotePdfEngine(
  resume: Resume,
  endpoint: string,
  iterations = 3,
): Promise<PdfBenchmarkStats> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ resume, iterations }),
  })

  if (!response.ok) {
    throw new Error(`Remote benchmark failed: ${response.status}`)
  }

  const data = await response.json() as Partial<PdfBenchmarkStats>
  if (typeof data.avgMs !== 'number' || typeof data.p50Ms !== 'number') {
    throw new Error('Remote benchmark payload invalid')
  }

  return {
    engine: data.engine === 'chromium' ? 'chromium' : 'remote',
    iterations: data.iterations ?? iterations,
    minMs: data.minMs ?? data.avgMs,
    maxMs: data.maxMs ?? data.avgMs,
    avgMs: data.avgMs,
    p50Ms: data.p50Ms,
    p95Ms: data.p95Ms ?? data.p50Ms,
    avgSizeKb: data.avgSizeKb ?? 0,
    avgHeadingCoveragePct: data.avgHeadingCoveragePct ?? 0,
    samplesMs: data.samplesMs ?? [],
  }
}

export async function countPdfPages(resume: Resume): Promise<number> {
  const blob = await renderResumePdfBlob(resume)
  const text = await blob.text()
  const treeMatch = text.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/)
  if (treeMatch) return parseInt(treeMatch[1], 10)
  const pages = text.match(/\/Type\s*\/Page\b(?!s)/g)
  return pages ? pages.length : 1
}

export async function downloadResumePdf(resume: Resume, fileName: string): Promise<void> {
  const blob = await renderResumePdfBlob(resume)
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}
