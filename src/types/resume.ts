export type TemplateName = 'minimal' | 'compact'

export type ResumeSectionKey =
  | 'summary'
  | 'education'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'accomplishments'
  | 'activities'
  | 'volunteering'
  | 'publications'

export const DEFAULT_SECTION_ORDER: ResumeSectionKey[] = [
  'summary',
  'education',
  'experience',
  'projects',
  'skills',
  'certifications',
  'accomplishments',
  'activities',
  'volunteering',
  'publications',
]

export type HeaderAlignment = 'center' | 'left'

export interface DocumentOptions {
  accentColor: string
  fontFamily:
    | 'satoshi'
    | 'clash'
    | 'spacegrotesk'
    | 'instrumentserif'
    | 'inter'
    | 'helvetica'
    | 'times'
  fontSize: 'small' | 'normal' | 'large'
  lineHeight: 'tight' | 'normal' | 'relaxed'
  sectionHeadingStyle: 'rule' | 'bold' | 'minimal'
  bulletStyle: 'dot' | 'dash'
  dateStyle: 'range' | 'compact' | 'short' | 'numeric' | 'iso'
  density: 'comfortable' | 'compact' | 'relaxed'
  linkDisplay: 'label' | 'url'
  headerAlignment: HeaderAlignment
  showSections: Record<ResumeSectionKey, boolean>
  sectionOrder: ResumeSectionKey[]
}

export interface ResumeMeta {
  version: '1.0'
  template: TemplateName
  createdAt: string
  updatedAt: string
  documentOptions: DocumentOptions
}

export interface ResumeLink {
  label: string
  url: string
}

export interface ResumeBasics {
  name: string
  headline: string
  email: string
  phone: string
  location: string
  summary: string
  links: ResumeLink[]
}

export interface EducationItem {
  institution: string
  degree: string
  field: string
  cgpa: string
  startDate: string
  endDate: string
  location: string
}

export interface ExperienceItem {
  company: string
  role: string
  location: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface ProjectItem {
  title: string
  projectLink: string
  repoLink: string
  techStack: string[]
  startDate: string
  endDate: string
  bullets: string[]
}

export interface Skills {
  languages: string[]
  frameworks: string[]
  tools: string[]
  other: string[]
}

export interface CertificationItem {
  title: string
  issuer: string
  date: string
  credentialId: string
  credentialUrl: string
}

export interface AccomplishmentItem {
  title: string
  organization: string
  location: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface ActivityItem {
  role: string
  organization: string
  location: string
  startDate: string
  endDate: string
  referenceUrl: string
}

export interface VolunteeringItem {
  role: string
  organization: string
  location: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface PublicationItem {
  title: string
  venue: string
  date: string
  url: string
}

export interface Resume {
  meta: ResumeMeta
  basics: ResumeBasics
  education: EducationItem[]
  experience: ExperienceItem[]
  projects: ProjectItem[]
  skills: Skills
  certifications: CertificationItem[]
  accomplishments: AccomplishmentItem[]
  activities: ActivityItem[]
  volunteering: VolunteeringItem[]
  publications: PublicationItem[]
}

export interface ValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
  qualityScore: number
  completenessScore: number
  score: number
}

export function createDefaultDocumentOptions(): DocumentOptions {
  return {
    accentColor: '#111111',
    fontFamily: 'satoshi',
    fontSize: 'normal',
    lineHeight: 'normal',
    sectionHeadingStyle: 'rule',
    bulletStyle: 'dot',
    dateStyle: 'range',
    density: 'comfortable',
    linkDisplay: 'label',
    headerAlignment: 'center',
    showSections: {
      // Basic starter set — optional sections are opt-in via the
      // "Visibility & Order" controls in the nav or Format panel.
      summary: true,
      education: true,
      experience: true,
      projects: true,
      skills: true,
      certifications: false,
      accomplishments: false,
      activities: false,
      volunteering: false,
      publications: false,
    },
    sectionOrder: [...DEFAULT_SECTION_ORDER],
  }
}

export function createEmptyResume(): Resume {
  const now = new Date().toISOString()

  return {
    meta: {
      version: '1.0',
      template: 'minimal',
      createdAt: now,
      updatedAt: now,
      documentOptions: createDefaultDocumentOptions(),
    },
    basics: {
      name: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      summary: '',
      links: [{ label: '', url: '' }],
    },
    education: [
      {
        institution: '',
        degree: '',
        field: '',
        cgpa: '',
        startDate: '',
        endDate: '',
        location: '',
      },
    ],
    experience: [],
    projects: [],
    skills: {
      languages: [],
      frameworks: [],
      tools: [],
      other: [],
    },
    certifications: [],
    accomplishments: [],
    activities: [],
    volunteering: [],
    publications: [],
  }
}
