import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  UnderlineType,
} from 'docx'
import { formatDateRangeByStyle, formatSingleDate } from '../lib/utils'
import { DEFAULT_SECTION_ORDER, type Resume, type ResumeSectionKey } from '../types/resume'

function hasContent<T extends object>(items: T[]): boolean {
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

function hasSkills(skills: Resume['skills']): boolean {
  return skills.languages.length > 0 || skills.frameworks.length > 0 || skills.tools.length > 0 || skills.other.length > 0
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

function toDocxFontFamily(fontFamily: Resume['meta']['documentOptions']['fontFamily']): string {
  if (fontFamily === 'times' || fontFamily === 'instrumentserif') {
    return 'Times New Roman'
  }
  if (fontFamily === 'spacegrotesk') {
    return 'Consolas'
  }
  return 'Calibri'
}

function toDocxFontSize(fontSize: Resume['meta']['documentOptions']['fontSize']): number {
  return fontSize === 'small' ? 20 : fontSize === 'large' ? 24 : 22
}

function toDocxLineSpacing(lineHeight: Resume['meta']['documentOptions']['lineHeight']): number {
  return lineHeight === 'tight' ? 280 : lineHeight === 'relaxed' ? 380 : 320
}

function toDocxAccent(accentColor: string): string {
  return accentColor.replace('#', '')
}

function sectionTitleText(sectionTitle: string, headingStyle: Resume['meta']['documentOptions']['sectionHeadingStyle']) {
  if (headingStyle === 'minimal') {
    return sectionTitle
  }
  return sectionTitle.toUpperCase()
}

function sectionTitleParagraph(title: string, resume: Resume): Paragraph {
  const options = resume.meta.documentOptions
  const showRule = options.sectionHeadingStyle === 'rule'

  return new Paragraph({
    spacing: { before: 220, after: 100 },
    border: showRule
      ? {
          bottom: { color: 'DFE4EA', size: 6, style: BorderStyle.SINGLE },
        }
      : undefined,
    children: [
      new TextRun({
        text: sectionTitleText(title, options.sectionHeadingStyle),
        bold: true,
        size: toDocxFontSize(options.fontSize),
        color: toDocxAccent(options.accentColor),
        font: toDocxFontFamily(options.fontFamily),
      }),
    ],
  })
}

function rowParagraph(left: string, right: string, resume: Resume): Paragraph {
  const options = resume.meta.documentOptions
  const textSize = toDocxFontSize(options.fontSize)

  if (!right.trim()) {
    return new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: left, bold: true, size: textSize, font: toDocxFontFamily(options.fontFamily) }),
      ],
    })
  }

  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9020 }],
    spacing: { after: 60 },
    children: [
      new TextRun({ text: left, bold: true, size: textSize, font: toDocxFontFamily(options.fontFamily) }),
      new TextRun({ text: `\t${right}`, size: textSize, color: '4B5563', font: toDocxFontFamily(options.fontFamily) }),
    ],
  })
}

function bodyParagraph(text: string, resume: Resume): Paragraph {
  const options = resume.meta.documentOptions
  return new Paragraph({
    spacing: { after: 50, line: toDocxLineSpacing(options.lineHeight) },
    children: [new TextRun({ text, size: toDocxFontSize(options.fontSize), font: toDocxFontFamily(options.fontFamily) })],
  })
}

function linkParagraph(prefix: string, label: string, url: string, resume: Resume): Paragraph {
  const options = resume.meta.documentOptions
  return new Paragraph({
    spacing: { after: 50, line: toDocxLineSpacing(options.lineHeight) },
    children: [
      new TextRun({ text: prefix, size: toDocxFontSize(options.fontSize), font: toDocxFontFamily(options.fontFamily) }),
      new ExternalHyperlink({
        link: url,
        children: [
          new TextRun({
            text: label,
            size: toDocxFontSize(options.fontSize),
            color: toDocxAccent(options.accentColor),
            underline: { type: UnderlineType.SINGLE },
            font: toDocxFontFamily(options.fontFamily),
          }),
        ],
      }),
    ],
  })
}

function bulletParagraph(text: string, resume: Resume): Paragraph {
  const options = resume.meta.documentOptions

  if (options.bulletStyle === 'dash') {
    return new Paragraph({
      spacing: { after: 40, line: toDocxLineSpacing(options.lineHeight) },
      indent: { left: 360 },
      children: [
        new TextRun({ text: `— ${text}`, size: toDocxFontSize(options.fontSize), font: toDocxFontFamily(options.fontFamily) }),
      ],
    })
  }

  return new Paragraph({
    spacing: { after: 40, line: toDocxLineSpacing(options.lineHeight) },
    bullet: { level: 0 },
    children: [
      new TextRun({ text, size: toDocxFontSize(options.fontSize), font: toDocxFontFamily(options.fontFamily) }),
    ],
  })
}

function renderSections(resume: Resume): Paragraph[] {
  const options = resume.meta.documentOptions
  const dateValue = (startDate: string, endDate: string) => formatDateRangeByStyle(startDate, endDate, options.dateStyle)
  const sectionOrder = [...new Set([...(options.sectionOrder ?? []), ...DEFAULT_SECTION_ORDER])]

  const shouldRender = (sectionId: ResumeSectionKey, hasContentForSection: boolean) => {
    return options.showSections[sectionId] && hasContentForSection
  }

  const paragraphs: Paragraph[] = []

  for (const sectionId of sectionOrder) {
    if (sectionId === 'summary' && shouldRender('summary', hasText(resume.basics.summary))) {
      paragraphs.push(sectionTitleParagraph('Summary', resume), bodyParagraph(resume.basics.summary, resume))
      continue
    }

    if (sectionId === 'education' && shouldRender('education', hasContent(resume.education))) {
      paragraphs.push(sectionTitleParagraph('Education', resume))
      for (const item of resume.education.filter(hasEducationItem)) {
        paragraphs.push(rowParagraph(item.institution, dateValue(item.startDate, item.endDate), resume))
        const line = [item.degree, item.field, item.cgpa ? `CGPA ${item.cgpa}` : ''].filter(Boolean).join(' • ')
        if (line) paragraphs.push(bodyParagraph(line, resume))
        if (item.location) paragraphs.push(bodyParagraph(item.location, resume))
      }
      continue
    }

    if (sectionId === 'experience' && shouldRender('experience', hasContent(resume.experience))) {
      paragraphs.push(sectionTitleParagraph('Experience', resume))
      for (const item of resume.experience.filter(hasExperienceItem)) {
        paragraphs.push(rowParagraph(`${item.role}${item.company ? `, ${item.company}` : ''}`, dateValue(item.startDate, item.endDate), resume))
        if (item.location) paragraphs.push(bodyParagraph(item.location, resume))
        for (const bullet of item.bullets.filter(Boolean)) {
          paragraphs.push(bulletParagraph(bullet, resume))
        }
      }
      continue
    }

    if (sectionId === 'projects' && shouldRender('projects', hasContent(resume.projects))) {
      paragraphs.push(sectionTitleParagraph('Projects', resume))
      for (const item of resume.projects.filter(hasProjectItem)) {
        paragraphs.push(rowParagraph(item.title, dateValue(item.startDate, item.endDate), resume))
        if (item.techStack.length > 0) paragraphs.push(bodyParagraph(`Tech: ${item.techStack.join(', ')}`, resume))
        if (item.projectLink) paragraphs.push(linkParagraph('Live: ', item.projectLink, item.projectLink, resume))
        if (item.repoLink) paragraphs.push(linkParagraph('Repo: ', item.repoLink, item.repoLink, resume))
        for (const bullet of item.bullets.filter(Boolean)) {
          paragraphs.push(bulletParagraph(bullet, resume))
        }
      }
      continue
    }

    if (sectionId === 'skills' && shouldRender('skills', hasSkills(resume.skills))) {
      paragraphs.push(sectionTitleParagraph('Skills', resume))
      if (resume.skills.languages.length > 0) paragraphs.push(bodyParagraph(`Languages: ${resume.skills.languages.join(', ')}`, resume))
      if (resume.skills.frameworks.length > 0) paragraphs.push(bodyParagraph(`Frameworks: ${resume.skills.frameworks.join(', ')}`, resume))
      if (resume.skills.tools.length > 0) paragraphs.push(bodyParagraph(`Tools: ${resume.skills.tools.join(', ')}`, resume))
      if (resume.skills.other.length > 0) paragraphs.push(bodyParagraph(`Other: ${resume.skills.other.join(', ')}`, resume))
      continue
    }

    if (sectionId === 'certifications' && shouldRender('certifications', hasContent(resume.certifications))) {
      paragraphs.push(sectionTitleParagraph('Certifications', resume))
      for (const item of resume.certifications.filter(hasCertificationItem)) {
        const date = formatSingleDate(item.date)
        const details = [
          item.credentialId ? `ID: ${item.credentialId}` : '',
          item.credentialUrl,
        ].filter(Boolean).join(' • ')
        const certLine = `${item.title} - ${item.issuer}${date ? ` (${date})` : ''}${details ? ` • ${details}` : ''}`
        paragraphs.push(bulletParagraph(certLine, resume))
      }
      continue
    }

    if (sectionId === 'accomplishments' && shouldRender('accomplishments', hasContent(resume.accomplishments))) {
      paragraphs.push(sectionTitleParagraph('Accomplishments', resume))
      for (const item of resume.accomplishments.filter(hasAccomplishmentItem)) {
        paragraphs.push(rowParagraph(item.title, dateValue(item.startDate, item.endDate), resume))
        const orgLine = [item.organization, item.location].filter(Boolean).join(' • ')
        if (orgLine) paragraphs.push(bodyParagraph(orgLine, resume))
        for (const bullet of item.bullets.filter(Boolean)) {
          paragraphs.push(bulletParagraph(bullet, resume))
        }
      }
      continue
    }

    if (sectionId === 'activities' && shouldRender('activities', hasContent(resume.activities))) {
      paragraphs.push(sectionTitleParagraph('Extra-curricular Activities', resume))
      for (const item of resume.activities.filter(hasActivityItem)) {
        paragraphs.push(rowParagraph(`${item.role}${item.organization ? `, ${item.organization}` : ''}`, dateValue(item.startDate, item.endDate), resume))
        if (item.location) paragraphs.push(bodyParagraph(item.location, resume))
        if (item.referenceUrl) {
          paragraphs.push(linkParagraph('', 'Reference / Certificate', item.referenceUrl, resume))
        }
      }
      continue
    }

    if (sectionId === 'volunteering' && shouldRender('volunteering', hasContent(resume.volunteering))) {
      paragraphs.push(sectionTitleParagraph('Volunteering', resume))
      for (const item of resume.volunteering.filter(hasVolunteeringItem)) {
        paragraphs.push(rowParagraph(`${item.role}${item.organization ? `, ${item.organization}` : ''}`, dateValue(item.startDate, item.endDate), resume))
        if (item.location) paragraphs.push(bodyParagraph(item.location, resume))
        for (const bullet of item.bullets.filter(Boolean)) {
          paragraphs.push(bulletParagraph(bullet, resume))
        }
      }
      continue
    }

    if (sectionId === 'publications' && shouldRender('publications', hasContent(resume.publications))) {
      paragraphs.push(sectionTitleParagraph('Publications', resume))
      for (const item of resume.publications.filter(hasPublicationItem)) {
        paragraphs.push(rowParagraph(item.title, formatSingleDate(item.date), resume))
        if (item.venue) paragraphs.push(bodyParagraph(item.venue, resume))
        if (item.url) paragraphs.push(linkParagraph('', item.url, item.url, resume))
      }
    }
  }

  return paragraphs
}

function createResumeDocxDocument(resume: Resume): Document {
  const options = resume.meta.documentOptions
  const linkValue = (label: string, url: string) => (options.linkDisplay === 'url' ? url : label || url)
  const contact = [resume.basics.email, resume.basics.phone, resume.basics.location].filter(Boolean).join(' • ')

  const linkRuns: Array<TextRun | ExternalHyperlink> = []
  resume.basics.links
    .filter((link) => !!link.url)
    .forEach((link, index) => {
      if (index > 0) {
        linkRuns.push(new TextRun({ text: ' • ', size: toDocxFontSize(options.fontSize), font: toDocxFontFamily(options.fontFamily) }))
      }
      linkRuns.push(
        new ExternalHyperlink({
          link: link.url,
          children: [
            new TextRun({
              text: linkValue(link.label, link.url),
              color: toDocxAccent(options.accentColor),
              underline: { type: UnderlineType.SINGLE },
              size: toDocxFontSize(options.fontSize),
              font: toDocxFontFamily(options.fontFamily),
            }),
          ],
        }),
      )
    })

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: resume.basics.name || 'Your Name',
          bold: true,
          size: 34,
          color: toDocxAccent(options.accentColor),
          font: toDocxFontFamily(options.fontFamily),
        }),
      ],
    }),
  ]

  if (resume.basics.headline) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: resume.basics.headline,
            color: '374151',
            size: toDocxFontSize(options.fontSize),
            font: toDocxFontFamily(options.fontFamily),
          }),
        ],
      }),
    )
  }

  if (contact) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: contact,
            color: '374151',
            size: toDocxFontSize(options.fontSize),
            font: toDocxFontFamily(options.fontFamily),
          }),
        ],
      }),
    )
  }

  if (linkRuns.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: linkRuns,
      }),
    )
  }

  children.push(...renderSections(resume))

  return new Document({
    sections: [
      {
        children,
      },
    ],
  })
}

export async function downloadResumeDocx(resume: Resume, fileName: string): Promise<void> {
  const doc = createResumeDocxDocument(resume)
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')

  link.href = url
  link.download = fileName
  window.document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}
