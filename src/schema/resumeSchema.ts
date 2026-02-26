import { z } from 'zod'

const sectionKeySchema = z.enum([
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
])

const linkSchema = z.object({
  label: z.string(),
  url: z.string(),
})

const educationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  cgpa: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string(),
})

const experienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  bullets: z.array(z.string()),
})

const projectSchema = z.object({
  title: z.string(),
  projectLink: z.string(),
  repoLink: z.string(),
  techStack: z.array(z.string()),
  startDate: z.string(),
  endDate: z.string(),
  bullets: z.array(z.string()),
})

const certificationSchema = z.object({
  title: z.string(),
  issuer: z.string(),
  date: z.string(),
  credentialId: z.string(),
  credentialUrl: z.string(),
})

const accomplishmentSchema = z.object({
  title: z.string(),
  organization: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  bullets: z.array(z.string()),
})

const activitySchema = z.object({
  role: z.string(),
  organization: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  referenceUrl: z.string(),
})

const volunteeringSchema = z.object({
  role: z.string(),
  organization: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  bullets: z.array(z.string()),
})

const publicationSchema = z.object({
  title: z.string(),
  venue: z.string(),
  date: z.string(),
  url: z.string(),
})

const documentOptionsSchema = z.object({
  accentColor: z.string(),
  fontFamily: z.enum([
    'satoshi',
    'clash',
    'spacegrotesk',
    'instrumentserif',
    'inter',
    'helvetica',
    'times',
  ]),
  fontSize: z.enum(['small', 'normal', 'large']),
  lineHeight: z.enum(['tight', 'normal', 'relaxed']),
  sectionHeadingStyle: z.enum(['rule', 'bold', 'minimal']),
  bulletStyle: z.enum(['dot', 'dash']),
  dateStyle: z.enum(['range', 'compact']),
  density: z.enum(['comfortable', 'compact', 'relaxed']),
  linkDisplay: z.enum(['label', 'url']),
  showSections: z.object({
    summary: z.boolean(),
    education: z.boolean(),
    experience: z.boolean(),
    projects: z.boolean(),
    skills: z.boolean(),
    certifications: z.boolean(),
    accomplishments: z.boolean(),
    activities: z.boolean(),
    volunteering: z.boolean(),
    publications: z.boolean(),
  }),
  sectionOrder: z.array(sectionKeySchema),
})

export const resumeSchema = z.object({
  meta: z.object({
    version: z.literal('1.0'),
    template: z.enum(['minimal', 'compact']),
    createdAt: z.string(),
    updatedAt: z.string(),
    documentOptions: documentOptionsSchema,
  }),
  basics: z.object({
    name: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    summary: z.string(),
    links: z.array(linkSchema),
  }),
  education: z.array(educationSchema),
  experience: z.array(experienceSchema),
  projects: z.array(projectSchema),
  skills: z.object({
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    tools: z.array(z.string()),
    other: z.array(z.string()),
  }),
  certifications: z.array(certificationSchema),
  accomplishments: z.array(accomplishmentSchema),
  activities: z.array(activitySchema),
  volunteering: z.array(volunteeringSchema),
  publications: z.array(publicationSchema),
})

export type ResumeSchema = z.infer<typeof resumeSchema>
