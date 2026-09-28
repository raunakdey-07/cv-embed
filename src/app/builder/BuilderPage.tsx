import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { AccomplishmentsSection } from '../../components/sections/Accomplishments'
import { ActivitiesSection } from '../../components/sections/Activities'
import { BasicsSection } from '../../components/sections/Basics'
import { CertificationsSection } from '../../components/sections/Certifications'
import { DocumentOptionsSection } from '../../components/sections/DocumentOptions'
import { EducationSection } from '../../components/sections/Education'
import { ExperienceSection } from '../../components/sections/Experience'
import { PublicationsSection } from '../../components/sections/Publications'
import { ProjectsSection } from '../../components/sections/Projects'
import { SkillsSection } from '../../components/sections/Skills'
import { SummarySection } from '../../components/sections/Summary'
import { VolunteeringSection } from '../../components/sections/Volunteering'
import { TemplateRenderer } from '../../components/templates/TemplateRenderer'
import {
  IconAlertTriangle, IconAward, IconBraces, IconBriefcase, IconCheck,
  IconChevronDown, IconCode, IconCopy, IconDownload, IconExternalLink,
  IconEye, IconFileText, IconFlag, IconGraduationCap,
  IconSliders, IconTrophy, IconUpload, IconUser, IconZap,
} from '../../components/ui/Icons'
import { createDownloadFileName, createPortableResumeUrl, decodeResumeFromUrl, encodeResumeForUrl, getResumeDataFromUrl, MAX_PORTABLE_PAYLOAD_CHARS, normalizeResume, withUpdatedTimestamp } from '../../lib/utils'
import { getOrderedSectionIds } from '../../lib/contentChecks'
import { loadDraft, loadPublicBaseUrl, saveDraft, savePublicBaseUrl, type DraftLoadStatus } from '../../lib/storage'
import { resolveNextActionSection, type BuilderSectionId } from '../../lib/nextAction'
import { validateResume } from '../../schema/validators'
import { createEmptyResume, type DocumentOptions, type Resume, type ResumeSectionKey } from '../../types/resume'
import { SectionNav, type NavSection } from '../../components/ui/SectionNav'


function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return new URL(withProtocol).origin
  } catch {
    return ''
  }
}

function getDefaultEmbedBaseUrl(): string {
  const envBaseUrl = normalizeBaseUrl((import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) ?? '')
  if (envBaseUrl) {
    return envBaseUrl
  }

  const stored = normalizeBaseUrl(loadPublicBaseUrl())
  if (stored) {
    return stored
  }

  return normalizeBaseUrl(window.location.origin)
}

function buildEmbedArtifacts(baseUrl: string, resume: Resume, options: EmbedBuildOptions): EmbedArtifacts {
  const origin = normalizeBaseUrl(baseUrl) || getDefaultEmbedBaseUrl()
  const encoded = encodeResumeForUrl(resume)
  const portableUrl = createPortableResumeUrl(origin, encoded, options.showDownload)
  const sdkPayload = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const paddedSdkPayload = sdkPayload + '='.repeat((4 - (sdkPayload.length % 4)) % 4)
  const sdkResumeData = `JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('${paddedSdkPayload}'), function (character) { return character.charCodeAt(0) })))`
  const sdkUrl = `${origin}/sdk.js?v=2`
  const iframeSnippet = `<iframe src="${portableUrl}" width="100%" height="${options.iframeHeight}" frameborder="0" loading="lazy" title="Resume"></iframe>`
  const sdkSnippet = `<script src="${sdkUrl}"></script>\n<div id="resume-container"></div>\n<script>\n  CVEmbed.render({\n    target: '#resume-container',\n    baseUrl: '${origin}',\n    resumeData: ${sdkResumeData},\n    height: ${options.iframeHeight},\n    options: {\n      showDownload: ${options.showDownload ? 'true' : 'false'},\n      autoHeight: true\n    },\n    events: {\n      onReady: () => console.log('resume loaded'),\n      onHeightChange: ({ height }) => console.log('resized to', height)\n    }\n  });\n</script>`
  const reactSnippet = `<iframe src="${portableUrl}" style={{ width: '100%', height: '${options.iframeHeight}px', border: 0 }} loading="lazy" title="Resume" />`
  const integrationPack = [
    'CV-Embed Integration Pack v2',
    '',
    `Embed URL:\n${portableUrl}`,
    '',
    `iframe:\n${iframeSnippet}`,
    '',
    `React iframe:\n${reactSnippet}`,
    '',
    `SDK:\n${sdkSnippet}`,
  ].join('\n')
  return { portableUrl, iframeSnippet, sdkSnippet, reactSnippet, integrationPack }
}

type SectionId =
  | 'basics' | 'summary' | 'education' | 'experience' | 'projects'
  | 'skills' | 'certifications' | 'accomplishments' | 'activities' | 'volunteering' | 'publications'
  | 'document-options'

const SECTION_NAV: { id: SectionId; Icon: (p: { size?: number }) => React.ReactNode; label: string }[] = [
  { id: 'basics', Icon: IconUser, label: 'Basics' },
  { id: 'document-options', Icon: IconSliders, label: 'Format' },
  { id: 'summary', Icon: IconFileText, label: 'Summary' },
  { id: 'education', Icon: IconGraduationCap, label: 'Education' },
  { id: 'experience', Icon: IconBriefcase, label: 'Experience' },
  { id: 'projects', Icon: IconCode, label: 'Projects' },
  { id: 'skills', Icon: IconZap, label: 'Skills' },
  { id: 'certifications', Icon: IconAward, label: 'Certifications' },
  { id: 'accomplishments', Icon: IconTrophy, label: 'Awards' },
  { id: 'activities', Icon: IconFlag, label: 'Activities' },
  { id: 'volunteering', Icon: IconFlag, label: 'Volunteer' },
  { id: 'publications', Icon: IconFileText, label: 'Publications' },
]

const SECTION_LABELS: Record<SectionId, string> = {
  basics: 'Basics',
  'document-options': 'Format',
  summary: 'Summary',
  education: 'Education',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
  accomplishments: 'Accomplishments',
  activities: 'Activities',
  volunteering: 'Volunteering',
  publications: 'Publications',
}

function getSectionFromIssue(issue: string): BuilderSectionId {
  const value = issue.toLowerCase()
  if (value.includes('basics')) return 'basics'
  if (value.includes('education')) return 'education'
  if (value.includes('experience')) return 'experience'
  if (value.includes('projects') || value.includes('project')) return 'projects'
  if (value.includes('skills') || value.includes('skill')) return 'skills'
  if (value.includes('certifications') || value.includes('certification')) return 'certifications'
  if (value.includes('accomplishments') || value.includes('accomplishment')) return 'accomplishments'
  if (value.includes('activities') || value.includes('activity')) return 'activities'
  if (value.includes('volunteering') || value.includes('volunteer')) return 'volunteering'
  if (value.includes('publications') || value.includes('publication')) return 'publications'
  return 'basics'
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}

function isBlankResume(resume: Resume): boolean {
  const basics = [
    resume.basics.name,
    resume.basics.headline,
    resume.basics.email,
    resume.basics.phone,
    resume.basics.location,
    resume.basics.summary,
    ...resume.basics.links.flatMap((link) => [link.label, link.url]),
  ]

  const education = resume.education.flatMap((item) => [item.institution, item.degree, item.field, item.cgpa, item.startDate, item.endDate, item.location])
  const experience = resume.experience.flatMap((item) => [item.company, item.role, item.location, item.startDate, item.endDate, ...item.bullets])
  const projects = resume.projects.flatMap((item) => [item.title, item.projectLink, item.repoLink, item.startDate, item.endDate, ...item.techStack, ...item.bullets])
  const skills = [...resume.skills.languages, ...resume.skills.frameworks, ...resume.skills.tools, ...resume.skills.other]
  const certifications = resume.certifications.flatMap((item) => [item.title, item.issuer, item.date, item.credentialId, item.credentialUrl])
  const accomplishments = resume.accomplishments.flatMap((item) => [item.title, item.organization, item.location, item.startDate, item.endDate, ...item.bullets])
  const activities = resume.activities.flatMap((item) => [item.role, item.organization, item.location, item.startDate, item.endDate, item.referenceUrl])
  const volunteering = resume.volunteering.flatMap((item) => [item.role, item.organization, item.location, item.startDate, item.endDate, ...item.bullets])
  const publications = resume.publications.flatMap((item) => [item.title, item.venue, item.date, item.url])

  return [
    ...basics,
    ...education,
    ...experience,
    ...projects,
    ...skills,
    ...certifications,
    ...accomplishments,
    ...activities,
    ...volunteering,
    ...publications,
  ].every((value) => !hasText(value))
}

interface EmbedArtifacts {
  portableUrl: string
  iframeSnippet: string
  sdkSnippet: string
  reactSnippet: string
  integrationPack: string
}

interface EmbedBuildOptions {
  iframeHeight: number
  showDownload: boolean
}

type EmbedPreset = 'placement' | 'portfolio' | 'showcase' | 'custom'

function getEmbedPresetConfig(preset: Exclude<EmbedPreset, 'custom'>): EmbedBuildOptions {
  if (preset === 'portfolio') {
    return { iframeHeight: 1200, showDownload: true }
  }
  if (preset === 'showcase') {
    return { iframeHeight: 900, showDownload: false }
  }
  return { iframeHeight: 1100, showDownload: false }
}

function formatRelativeTime(from: number, to: number): string {
  const seconds = Math.max(0, Math.floor((to - from) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function downloadJson(resume: Resume, fileName = 'resume.json'): void {
  const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = fileName
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

const DRAFT_SAVE_DEBOUNCE_MS = 900

function getScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

function loadInitialState(): { resume: Resume; draftStatus: DraftLoadStatus; draftPreserved: boolean } {
  const handoffData = getResumeDataFromUrl(new URL(window.location.href))
  if (handoffData) {
    const decoded = decodeResumeFromUrl(handoffData)
    if (decoded) return { resume: decoded, draftStatus: 'missing', draftPreserved: false }
  }
  const draft = loadDraft()
  return {
    resume: draft.resume ?? createEmptyResume(),
    draftStatus: draft.status,
    draftPreserved: draft.preserved,
  }
}

export function BuilderPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const popoverZoneRef = useRef<HTMLDivElement>(null)
  const pageCountCacheRef = useRef<Map<string, number>>(new Map())
  const pageCountJobRef = useRef(0)
  const pageCountDelayTimerRef = useRef<number | null>(null)
  const pageCountIdleHandleRef = useRef<number | null>(null)
  const lastEstimatedResumeRef = useRef<Resume | null>(null)

  const [initialState] = useState(loadInitialState)
  const [resume, setResume] = useState<Resume>(initialState.resume)
  // After an unreadable draft is recovered the builder starts empty. Hold the
  // autosave until the user types, so the empty CV is never written back over
  // storage on its own.
  const holdAutosaveRef = useRef(initialState.draftStatus === 'unreadable')
  const [embedArtifacts, setEmbedArtifacts] = useState<EmbedArtifacts | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const [activeSection, setActiveSection] = useState<SectionId>('basics')
  const [exportOpen, setExportOpen] = useState(false)
  const [openPopover, setOpenPopover] = useState<'info' | 'fixNext' | 'clean' | 'score' | null>(null)
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const [formatOpen, setFormatOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const scoreZoneRef = useRef<HTMLDivElement>(null)
  const [estimatedPages, setEstimatedPages] = useState(1)
  const [isPageEstimateStale, setIsPageEstimateStale] = useState(false)
  const [isPageEstimating, setIsPageEstimating] = useState(false)
  const [embedBaseUrl] = useState<string>(() => getDefaultEmbedBaseUrl())
  const [embedPreset, setEmbedPreset] = useState<EmbedPreset>('placement')
  const [embedIframeHeight, setEmbedIframeHeight] = useState(1100)
  const [embedShowDownload, setEmbedShowDownload] = useState(false)
  const [embedPreviewOpen, setEmbedPreviewOpen] = useState(false)
  const isEmbedPanelOpen = embedArtifacts !== null
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saved')
  const [savedAt, setSavedAt] = useState<number>(() => Date.now())
  const [relativeNow, setRelativeNow] = useState<number>(() => Date.now())

  const latestResumeRef = useRef(resume)
  const noticeTimerRef = useRef<number | null>(null)
  const isEmptyResume = useMemo(() => isBlankResume(resume), [resume])

  const showNotice = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    setNotice({ message, tone })
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
    }
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null
      setNotice(null)
    }, tone === 'error' ? 6000 : 2200)
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.hash.includes('data=')) {
      url.hash = ''
      window.history.replaceState(null, '', `${url.pathname}${url.search}`)
    }
  }, [])

  useEffect(() => {
    if (initialState.draftStatus !== 'unreadable') return
    showNotice(
      initialState.draftPreserved
        ? 'Your saved CV could not be read and was not overwritten. A copy of the unreadable data was kept in this browser.'
        : 'Your saved CV could not be read. It was not overwritten.',
      'error',
    )
  }, [initialState.draftStatus, initialState.draftPreserved, showNotice])

  useEffect(() => {
    latestResumeRef.current = resume
  }, [resume])

  useEffect(() => {
    if (holdAutosaveRef.current && isEmptyResume) {
      setSaveState('error')
      return
    }
    holdAutosaveRef.current = false
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      const saved = saveDraft(withUpdatedTimestamp(resume))
      setSavedAt(Date.now())
      setSaveState(saved ? 'saved' : 'error')
    }, DRAFT_SAVE_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [resume, isEmptyResume])

  useEffect(() => {
    const flushDraft = () => {
      saveDraft(withUpdatedTimestamp(latestResumeRef.current))
    }
    window.addEventListener('pagehide', flushDraft)
    return () => window.removeEventListener('pagehide', flushDraft)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setRelativeNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
      if (popoverZoneRef.current && !popoverZoneRef.current.contains(e.target as Node)) setOpenPopover(null)
      if (scoreZoneRef.current && !scoreZoneRef.current.contains(e.target as Node)) {
        setOpenPopover((p) => (p === 'score' ? null : p))
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!openPopover) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPopover(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openPopover])

  useEffect(() => {
    savePublicBaseUrl(normalizeBaseUrl(embedBaseUrl))
  }, [embedBaseUrl])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches)
    }

    setIsMobileLayout(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!isEmbedPanelOpen) return
    try {
      setEmbedArtifacts(buildEmbedArtifacts(embedBaseUrl, withUpdatedTimestamp(resume), {
        iframeHeight: embedIframeHeight,
        showDownload: embedShowDownload,
      }))
    } catch {
      showNotice('Embed link is too large to generate reliably.', 'error')
    }
  }, [isEmbedPanelOpen, embedBaseUrl, resume, embedIframeHeight, embedShowDownload, showNotice])

  const clearScheduledPageCount = useCallback(() => {
    if (pageCountDelayTimerRef.current !== null) {
      window.clearTimeout(pageCountDelayTimerRef.current)
      pageCountDelayTimerRef.current = null
    }

    if (pageCountIdleHandleRef.current !== null) {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(pageCountIdleHandleRef.current)
      } else {
        window.clearTimeout(pageCountIdleHandleRef.current)
      }
      pageCountIdleHandleRef.current = null
    }
  }, [])

  const schedulePageEstimate = useCallback((priority: 'idle' | 'urgent') => {
    clearScheduledPageCount()
    const scheduledJobId = pageCountJobRef.current + 1
    pageCountJobRef.current = scheduledJobId

    if (isBlankResume(resume)) {
      lastEstimatedResumeRef.current = resume
      setEstimatedPages(1)
      setIsPageEstimateStale(false)
      setIsPageEstimating(false)
      return
    }

    setIsPageEstimateStale(true)
    setIsPageEstimating(true)

    const delay = priority === 'urgent' ? 80 : 1800

    pageCountDelayTimerRef.current = window.setTimeout(() => {
      pageCountDelayTimerRef.current = null

      const run = async () => {
        const cacheKey = JSON.stringify(resume)
        const cached = pageCountCacheRef.current.get(cacheKey)
        if (typeof cached === 'number') {
          lastEstimatedResumeRef.current = resume
          setEstimatedPages(cached)
          setIsPageEstimateStale(false)
          setIsPageEstimating(false)
          return
        }

        const jobId = scheduledJobId
        const perfLabel = `cv-embed-page-estimate-${jobId}`
        performance.mark(`${perfLabel}-start`)

        try {
          const { countPdfPages } = await import('../../pdf/pdfRenderer')
          const count = await countPdfPages(resume)
          if (pageCountJobRef.current !== jobId) {
            return
          }

          pageCountCacheRef.current.set(cacheKey, count)
          if (pageCountCacheRef.current.size > 24) {
            const oldestKey = pageCountCacheRef.current.keys().next().value as string | undefined
            if (oldestKey) {
              pageCountCacheRef.current.delete(oldestKey)
            }
          }

          performance.mark(`${perfLabel}-end`)
          performance.measure(perfLabel, `${perfLabel}-start`, `${perfLabel}-end`)

          lastEstimatedResumeRef.current = resume
          setEstimatedPages(count)
          setIsPageEstimateStale(false)
          setIsPageEstimating(false)
        } catch {
          if (pageCountJobRef.current === jobId) {
            setIsPageEstimateStale(false)
            setIsPageEstimating(false)
          }
        } finally {
          performance.clearMarks(`${perfLabel}-start`)
          performance.clearMarks(`${perfLabel}-end`)
          performance.clearMeasures(perfLabel)
        }
      }

      if (priority === 'urgent') {
        void run()
        return
      }

      if (typeof window.requestIdleCallback === 'function') {
        pageCountIdleHandleRef.current = window.requestIdleCallback(() => {
          pageCountIdleHandleRef.current = null
          void run()
        }, { timeout: 1400 })
      } else {
        pageCountIdleHandleRef.current = window.setTimeout(() => {
          pageCountIdleHandleRef.current = null
          void run()
        }, 250)
      }
    }, delay)
  }, [clearScheduledPageCount, resume])

  useEffect(() => {
    if (exportOpen || isEmbedPanelOpen) {
      schedulePageEstimate('urgent')
    }
  }, [exportOpen, isEmbedPanelOpen, schedulePageEstimate])

  const validation = useMemo(() => validateResume(resume), [resume])

  const issueSummary = useMemo(() => {
    const errorCount = validation.errors.length
    const warningCount = validation.warnings.length
    const total = errorCount + warningCount
    const severity: 'clean' | 'warnings' | 'errors' = errorCount > 0 ? 'errors' : warningCount > 0 ? 'warnings' : 'clean'
    const label = total === 0 ? 'Clean' : `${errorCount}E / ${warningCount}W`
    const details = [
      ...validation.errors.slice(0, 2).map((value) => `Error: ${value}`),
      ...validation.warnings.slice(0, 2).map((value) => `Warning: ${value}`),
    ]
    return {
      total,
      label,
      severity,
      title: details.length > 0 ? details.join('\n') : 'No validation issues',
    }
  }, [validation.errors, validation.warnings])

  const qualityScoreLabel = `Quality: ${validation.qualityScore}/100`

  const nextIssueSection = useMemo((): BuilderSectionId | null => {
    const issue = validation.errors[0] ?? validation.warnings[0]
    return issue ? getSectionFromIssue(issue) : null
  }, [validation.errors, validation.warnings])

  const completion = useMemo(() => {
    const hasText = (value: string) => value.trim().length > 0
    const uniqueSkillCount = new Set([
      ...resume.skills.languages,
      ...resume.skills.frameworks,
      ...resume.skills.tools,
      ...resume.skills.other,
    ].map((value) => value.trim().toLowerCase()).filter(Boolean)).size
    const visibleSections = resume.meta.documentOptions.showSections

    const sectionCompletion = {
      summary: hasText(resume.basics.summary),
      education: resume.education.some((item) => [item.institution, item.degree, item.field, item.cgpa, item.startDate, item.endDate, item.location].some(hasText)),
      experience: resume.experience.some((item) => [item.company, item.role, item.location, item.startDate, item.endDate].some(hasText) || item.bullets.some(hasText)),
      projects: resume.projects.some((item) => [item.title, item.projectLink, item.repoLink, item.startDate, item.endDate].some(hasText) || item.techStack.some(hasText) || item.bullets.some(hasText)),
      skills: [
        ...resume.skills.languages,
        ...resume.skills.frameworks,
        ...resume.skills.tools,
        ...resume.skills.other,
      ].some(hasText),
      certifications: resume.certifications.some((item) => [item.title, item.issuer, item.date, item.credentialId, item.credentialUrl].some(hasText)),
      accomplishments: resume.accomplishments.some((item) => [item.title, item.organization, item.location].some(hasText) || item.bullets.some(hasText)),
      activities: resume.activities.some((item) => [item.role, item.organization, item.location, item.referenceUrl].some(hasText)),
      volunteering: resume.volunteering.some((item) => [item.role, item.organization, item.location].some(hasText) || item.bullets.some(hasText)),
      publications: resume.publications.some((item) => [item.title, item.venue, item.date, item.url].some(hasText)),
    }

    const basicsCoreReady = hasText(resume.basics.name) && (hasText(resume.basics.email) || hasText(resume.basics.phone))
    const essentialChecks: Array<{ section: BuilderSectionId; ready: boolean }> = [
      { section: 'basics', ready: basicsCoreReady },
    ]
    if (visibleSections.education) {
      essentialChecks.push({ section: 'education', ready: sectionCompletion.education })
    }
    if (visibleSections.experience || visibleSections.projects) {
      essentialChecks.push({
        section: visibleSections.experience ? 'experience' : 'projects',
        ready: sectionCompletion.experience || sectionCompletion.projects,
      })
    }
    if (visibleSections.skills) {
      essentialChecks.push({ section: 'skills', ready: uniqueSkillCount >= 3 })
    }

    const firstMissingEssentialSection = essentialChecks.find((check) => !check.ready)?.section ?? null
    const visibleSectionKeys = Object.entries(visibleSections)
      .filter(([, visible]) => visible)
      .map(([section]) => section as keyof typeof sectionCompletion)
    const blocksTotal = 1 + visibleSectionKeys.length
    const blocksDone = (basicsCoreReady ? 1 : 0) + visibleSectionKeys.filter((section) => sectionCompletion[section]).length
    const essentialsDone = essentialChecks.filter((check) => check.ready).length
    const essentialsTotal = essentialChecks.length

    return {
      done: blocksDone,
      total: blocksTotal,
      percent: blocksTotal > 0 ? Math.round((blocksDone / blocksTotal) * 100) : 0,
      essentialsDone,
      essentialsTotal,
      essentialsPercent: Math.round((essentialsDone / essentialsTotal) * 100),
      firstMissingEssentialSection,
    }
  }, [resume])

  const nextActionSection = useMemo((): BuilderSectionId | null => {
    return resolveNextActionSection(completion.firstMissingEssentialSection, nextIssueSection)
  }, [completion.firstMissingEssentialSection, nextIssueSection])

  const fixNextTooltipText = useMemo(() => {
    const firstIssue = validation.errors[0] ?? validation.warnings[0]
    if (nextActionSection && firstIssue) {
      return `Next: ${firstIssue}`
    }
    if (nextActionSection) {
      return `Next action: complete ${SECTION_LABELS[nextActionSection]} first.`
    }
    return 'Next action: fix the listed validation issue.'
  }, [nextActionSection, validation.errors, validation.warnings])


  const saveStatusText = saveState === 'saving'
    ? 'Saving draft…'
    : saveState === 'error'
      ? 'Draft not saved'
      : `Saved ${formatRelativeTime(savedAt, relativeNow)}`

  const hasPageEstimate = isEmptyResume || lastEstimatedResumeRef.current === resume
  const pageIndicatorText = isEmptyResume
    ? 'Preview pages: 1'
    : hasPageEstimate
      ? `${isPageEstimating && isPageEstimateStale ? 'Est. PDF pages' : 'PDF pages'}: ${estimatedPages}`
      : 'PDF pages: not checked'
  const pageIndicatorTitle = isEmptyResume
    ? 'An empty CV renders on one logical page.'
    : 'Estimated A4 pages in the PDF export. Checking starts when you open export or embed tools.'

  const onImportJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_PORTABLE_PAYLOAD_CHARS) {
      showNotice('Import failed. Choose a CV-Embed JSON file smaller than 1 MB.', 'error')
      return
    }

    try {
      const next = normalizeResume(JSON.parse(await file.text()) as unknown)
      setResume(next)
      setEmbedArtifacts(null)
      showNotice('Resume imported.')
    } catch {
      showNotice('Import failed. Choose a valid CV-Embed JSON export.', 'error')
    }
  }

  const createEmbedLink = useCallback(() => {
    if (embedArtifacts) {
      setEmbedArtifacts(null)
      setEmbedPreviewOpen(false)
      return
    }

    try {
      setEmbedArtifacts(buildEmbedArtifacts(embedBaseUrl, withUpdatedTimestamp(resume), {
        iframeHeight: embedIframeHeight,
        showDownload: embedShowDownload,
      }))
      showNotice('Embed link generated.')
    } catch {
      showNotice('Embed link is too large to generate reliably.', 'error')
    }
  }, [embedArtifacts, embedBaseUrl, resume, embedIframeHeight, embedShowDownload, showNotice])

  // Header "Embed" button toggles the panel (App dispatches this event).
  useEffect(() => {
    const handler = () => createEmbedLink()
    window.addEventListener('cvembed:toggle-embed', handler)
    return () => window.removeEventListener('cvembed:toggle-embed', handler)
  }, [createEmbedLink])

  useEffect(() => {
    const handler = () => fileRef.current?.click()
    window.addEventListener('cvembed:import-json', handler)
    return () => window.removeEventListener('cvembed:import-json', handler)
  }, [])

  const onEmbedPresetChange = (preset: EmbedPreset) => {
    setEmbedPreset(preset)
    if (preset === 'custom') return
    const config = getEmbedPresetConfig(preset)
    setEmbedIframeHeight(config.iframeHeight)
    setEmbedShowDownload(config.showDownload)
  }

  const onEmbedHeightChange = (value: number) => {
    setEmbedPreset('custom')
    setEmbedIframeHeight(Math.max(600, Math.min(2400, value)))
  }

  const onEmbedDownloadChange = (checked: boolean) => {
    setEmbedPreset('custom')
    setEmbedShowDownload(checked)
  }

  const onDownloadPdf = useCallback(async () => {
    if (isBlankResume(resume)) {
      showNotice('Add your name and at least one section before exporting. The document is empty right now.', 'error')
      return
    }
    try {
      setBusy(true)
      const { downloadResumePdf } = await import('../../pdf/pdfRenderer')
      await downloadResumePdf(resume, createDownloadFileName(resume.basics.name, 'pdf'))
      showNotice('PDF downloaded.')
    } catch (error) {
      if (error instanceof Error && error.name === 'PdfUnsupportedCharactersError') {
        const characters = 'characters' in error && Array.isArray(error.characters)
          ? (error.characters as string[]).slice(0, 6).join(' ')
          : ''
        showNotice(`PDF cannot render ${characters || 'some characters'} in this CV. Use DOCX or replace the unsupported characters.`, 'error')
      } else {
        showNotice('PDF export failed. Your draft is unchanged.', 'error')
      }
    } finally {
      setBusy(false)
    }
  }, [resume, showNotice])

  const onDownloadDocx = useCallback(async () => {
    if (isBlankResume(resume)) {
      showNotice('Add your name and at least one section before exporting. The document is empty right now.', 'error')
      return
    }
    try {
      setBusy(true)
      const { downloadResumeDocx } = await import('../../docx/docxRenderer')
      await downloadResumeDocx(resume, createDownloadFileName(resume.basics.name, 'docx'))
      showNotice('DOCX downloaded.')
    } catch {
      showNotice('DOCX export failed. Your draft is unchanged.', 'error')
    } finally {
      setBusy(false)
    }
  }, [resume, showNotice])

  const onDownloadJson = useCallback(() => {
    try {
      downloadJson(withUpdatedTimestamp(resume), createDownloadFileName(resume.basics.name, 'json'))
      showNotice('JSON downloaded.')
    } catch {
      showNotice('JSON export failed. Your draft is unchanged.', 'error')
    }
  }, [resume, showNotice])

  const copyTo = useCallback(async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      showNotice(`${label} copied.`)
    } catch {
      showNotice(`Could not copy ${label}.`, 'error')
    }
  }, [showNotice])

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
    }
  }, [])

  const embedSnippetCards = embedArtifacts ? [
    {
      key: 'iframe',
      label: 'HTML',
      title: 'Website / portal',
      description: 'Paste into any page, CMS block, or portal rich-text field that allows HTML.',
      value: embedArtifacts.iframeSnippet,
    },
    {
      key: 'react',
      label: 'React',
      title: 'React app',
      description: 'Drop-in JSX component for React projects.',
      value: embedArtifacts.reactSnippet,
    },
    {
      key: 'sdk',
      label: 'SDK',
      title: 'Advanced (auto-height + events)',
      description: 'Script integration with resize and event callbacks.',
      value: embedArtifacts.sdkSnippet,
    },
    {
      key: 'pack',
      label: 'All',
      title: 'Everything in one copy',
      description: 'Link plus all snippets — handy to save or share with a developer.',
      value: embedArtifacts.integrationPack,
    },
  ] : []

  const scrollTo = (id: SectionId) => {
    // Hidden sections have no panel to scroll to.
    if (id !== 'document-options' && !resume.meta.documentOptions.showSections[id as ResumeSectionKey]) return
    setActiveSection(id)
    if (isMobileLayout) setMobileView('edit')
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' })
  }

  const sectionCls = (id: SectionId) =>
    `section-shell ${activeSection === id ? 'is-active' : ''}`

  const toggleSectionVisibility = useCallback((sectionId: keyof DocumentOptions['showSections']) => {
    setResume((p) => ({
      ...p,
      meta: {
        ...p.meta,
        documentOptions: {
          ...p.meta.documentOptions,
          showSections: {
            ...p.meta.documentOptions.showSections,
            [sectionId]: !p.meta.documentOptions.showSections[sectionId],
          },
        },
      },
    }))
  }, [])

  const moveSectionOrder = useCallback((sectionId: keyof DocumentOptions['showSections'], direction: -1 | 1) => {
    setResume((p) => {
      const order = p.meta.documentOptions.sectionOrder
      const currentIndex = order.indexOf(sectionId)
      const targetIndex = currentIndex + direction
      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= order.length) return p

      const next = [...order]
      const [picked] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, picked)
      return {
        ...p,
        meta: {
          ...p.meta,
          documentOptions: {
            ...p.meta.documentOptions,
            sectionOrder: next,
          },
        },
      }
    })
  }, [])

  const navSections: NavSection[] = SECTION_NAV.map((s) => ({
    id: s.id,
    label: s.label,
    active: activeSection === s.id,
    hidden: s.id !== 'document-options' && !resume.meta.documentOptions.showSections[s.id as ResumeSectionKey],
  }))

  // Only render editor panels for sections enabled in the resume; hidden
  // sections drop out of the nav too so the editing flow matches the output.
  const visibleNavSections = navSections.filter((s) => !s.hidden)

  // Form panels follow sectionOrder so editing order matches nav/preview/export.
  const orderedFormSections = useMemo(() => {
    const options = resume.meta.documentOptions
    const order = getOrderedSectionIds(resume)

    const nodes: Partial<Record<ResumeSectionKey, React.ReactNode>> = {
      education: <EducationSection education={resume.education} onChange={(education) => setResume((p) => ({ ...p, education }))} />,
      experience: <ExperienceSection experience={resume.experience} onChange={(experience) => setResume((p) => ({ ...p, experience }))} />,
      projects: <ProjectsSection projects={resume.projects} onChange={(projects) => setResume((p) => ({ ...p, projects }))} />,
      skills: <SkillsSection skills={resume.skills} onChange={(skills) => setResume((p) => ({ ...p, skills }))} />,
      certifications: <CertificationsSection certifications={resume.certifications} onChange={(certifications) => setResume((p) => ({ ...p, certifications }))} />,
      accomplishments: <AccomplishmentsSection accomplishments={resume.accomplishments} onChange={(accomplishments) => setResume((p) => ({ ...p, accomplishments }))} />,
      activities: <ActivitiesSection activities={resume.activities} onChange={(activities) => setResume((p) => ({ ...p, activities }))} />,
      volunteering: <VolunteeringSection volunteering={resume.volunteering} onChange={(volunteering) => setResume((p) => ({ ...p, volunteering }))} />,
      publications: <PublicationsSection publications={resume.publications} onChange={(publications) => setResume((p) => ({ ...p, publications }))} />,
      summary: <SummarySection summary={resume.basics.summary} onChange={(summary) => setResume((p) => ({ ...p, basics: { ...p.basics, summary } }))} />,
    }

    return order
      .filter((key) => options.showSections[key] && nodes[key])
      .map((key) => ({ key, node: nodes[key] as React.ReactNode }))
  }, [resume])

  const jumpToFirstIssue = useCallback(() => {
    const section = nextActionSection
    if (!section) return
    if (section !== 'document-options' && !resume.meta.documentOptions.showSections[section as ResumeSectionKey]) {
      // The flagged section is hidden from the resume; nothing to fix there.
      return
    }

    setActiveSection(section)
    requestAnimationFrame(() => {
      const target = document.getElementById(`section-${section}`)
      target?.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' })
      const field = target?.querySelector<HTMLElement>('input, textarea, select')
      ;(field ?? target)?.focus({ preventScroll: true })
    })
  }, [nextActionSection, resume.meta.documentOptions.showSections])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const withCommand = event.metaKey || event.ctrlKey
      if (!withCommand) return

      const key = event.key.toLowerCase()

      if (key === 's' && !event.shiftKey) {
        event.preventDefault()
        if (!busy) {
          void onDownloadPdf()
        }
        return
      }

      if (event.shiftKey && key === 'e') {
        event.preventDefault()
        createEmbedLink()
        return
      }

      if (event.shiftKey && key === 'j') {
        event.preventDefault()
        jumpToFirstIssue()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [busy, createEmbedLink, jumpToFirstIssue, onDownloadPdf])

  return (
    <main id="main-content" className={`app-main two-pane ${isMobileLayout ? 'is-mobile-layout' : ''}`}>
      {notice ? (
        <div className={`operation-notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.message}
        </div>
      ) : null}
      <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Import resume JSON" onChange={onImportJson} />
      {isMobileLayout ? (
        <div className="mobile-view-toggle" role="group" aria-label="Builder view">
          <button
            type="button"
            aria-pressed={mobileView === 'edit'}
            className={`mobile-view-tab ${mobileView === 'edit' ? 'active' : ''}`}
            onClick={() => setMobileView('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            aria-pressed={mobileView === 'preview'}
            className={`mobile-view-tab ${mobileView === 'preview' ? 'active' : ''}`}
            onClick={() => setMobileView('preview')}
          >
            Preview
          </button>
        </div>
      ) : null}

      {!isMobileLayout || mobileView === 'edit' ? (
      <section className={`left-pane ${isMobileLayout ? 'mobile-pane-enter' : ''}`}>
        <div className="completion-strip" ref={popoverZoneRef} title="Readiness based on section coverage, essentials, and validation state">
          <div className="completion-head">
            <div className="completion-title-group">
              <div className="completion-title-row">
                <span className="completion-title">Resume Readiness</span>
                <span className="completion-inline-tools">
                  <span
                    className={`completion-info-wrap${openPopover === 'info' ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="completion-info-btn"
                      aria-label="Readiness details"
                      aria-controls="readiness-details"
                      aria-expanded={openPopover === 'info'}
                      onClick={() => setOpenPopover((p) => (p === 'info' ? null : 'info'))}
                    >i</button>
                    <span id="readiness-details" className="completion-pill-popover completion-info-popover" role="tooltip" aria-hidden={openPopover !== 'info'}>
                      {completion.done}/{completion.total} sections complete • Essentials {completion.essentialsDone}/{completion.essentialsTotal}
                    </span>
                  </span>
                </span>
              </div>
            </div>
            <div className="completion-head-right">
              {issueSummary.total > 0 ? (
                <div
                  className={`completion-pill-wrap${openPopover === 'fixNext' ? ' is-open' : ''}`}
                >
                  <button
                    type="button"
                    className={`completion-pill completion-pill-action completion-pill-compact ${issueSummary.severity === 'errors' ? 'error' : 'warn'}`}
                    title="Jump to first essentials gap or issue (Ctrl/Cmd+Shift+J)"
                    aria-label="Fix next issue"
                    aria-controls="fix-next-details"
                    aria-expanded={openPopover === 'fixNext'}
                    onClick={() => {
                      if (openPopover === 'fixNext') {
                        jumpToFirstIssue()
                        setOpenPopover(null)
                      } else {
                        setOpenPopover('fixNext')
                      }
                    }}
                  >
                    <IconAlertTriangle size={10} /> {issueSummary.label}
                  </button>
                  <div id="fix-next-details" className="completion-pill-popover" role="tooltip" aria-hidden={openPopover !== 'fixNext'}>
                    {fixNextTooltipText}
                  </div>
                </div>
              ) : (
                <div
                  className={`completion-pill-wrap${openPopover === 'clean' ? ' is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="completion-pill completion-pill-compact ok"
                    aria-label="No validation issues"
                    aria-controls="clean-details"
                    aria-expanded={openPopover === 'clean'}
                    onClick={() => setOpenPopover((p) => (p === 'clean' ? null : 'clean'))}
                  >
                    <IconCheck size={10} /> Clean
                  </button>
                  <div id="clean-details" className="completion-pill-popover" role="tooltip" aria-hidden={openPopover !== 'clean'}>
                    No validation issues right now. Review the exported PDF before sending it.
                  </div>
                </div>
              )}
              <span className="completion-value">{completion.percent}%</span>
            </div>
          </div>
          <div className="completion-track" aria-hidden>
            <span className="completion-fill" style={{ width: `${completion.percent}%` }} />
          </div>
          {isEmptyResume ? <p className="completion-empty-note">Add your name and contact details to begin.</p> : null}
        </div>

        {embedArtifacts ? (
          <div className="embed-strip">
            <p className="embed-tip embed-tip-lead">
              Your resume is ready to embed. Pick where you're adding it and copy the matching snippet.
            </p>
            <div className="embed-config-row">
              <label className="embed-config-item embed-config-pill">
                <span className="embed-label">Where?</span>
                <select
                  className="embed-preset-select"
                  value={embedPreset}
                  onChange={(event) => onEmbedPresetChange(event.target.value as EmbedPreset)}
                >
                  <option value="placement">Job portal / ATS</option>
                  <option value="portfolio">Personal site / portfolio</option>
                  <option value="showcase">Compact widget</option>
                </select>
              </label>
              <label className="embed-config-item embed-config-pill">
                <span className="embed-label">Height</span>
                <input
                  className="embed-height-input"
                  type="number"
                  min={600}
                  max={2400}
                  step={50}
                  value={embedIframeHeight}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10)
                    if (Number.isNaN(parsed)) return
                    onEmbedHeightChange(parsed)
                  }}
                />
              </label>
              <label className="embed-config-item embed-config-pill embed-toggle-item">
                <span className="embed-label">Download button</span>
                <input
                  type="checkbox"
                  checked={embedShowDownload}
                  onChange={(event) => onEmbedDownloadChange(event.target.checked)}
                />
                <span className="embed-toggle-text">{embedShowDownload ? 'Shown' : 'Hidden'}</span>
              </label>
            </div>
            <div className="embed-link-card">
              <div className="embed-link-card-head">
                <span className="embed-label">Shareable link</span>
                <div className="embed-link-actions">
                  <a href={embedArtifacts.portableUrl} target="_blank" rel="noreferrer" className="embed-icon-btn" aria-label="Open embed URL" title="Open in new tab">
                    <IconExternalLink size={11} />
                  </a>
                  <button type="button" className="embed-icon-btn" onClick={() => copyTo('Embed URL', embedArtifacts.portableUrl)} aria-label="Copy embed URL" title="Copy link">
                    <IconCopy size={11} />
                  </button>
                </div>
              </div>
              <span className="embed-url" title={embedArtifacts.portableUrl}>{embedArtifacts.portableUrl}</span>
            </div>
            <div className="embed-snippet-grid">
              {embedSnippetCards.map((card) => (
                <div className="embed-snippet-card" key={card.key}>
                  <div className="embed-snippet-head">
                    <div className="embed-snippet-title-group">
                      <span className="embed-snippet-tag">{card.label}</span>
                      <div>
                        <p className="embed-snippet-title">{card.title}</p>
                        <p className="embed-snippet-description">{card.description}</p>
                      </div>
                    </div>
                    <button type="button" className="embed-icon-btn" onClick={() => copyTo(card.title, card.value)} aria-label={`Copy ${card.label} snippet`} title="Copy code">
                      <IconCopy size={11} />
                    </button>
                  </div>
                  <pre className="embed-snippet-code" title={card.value}>{card.value}</pre>
                </div>
              ))}
            </div>
            <details
              className="embed-preview-details"
              onToggle={(event) => setEmbedPreviewOpen(event.currentTarget.open)}
            >
              <summary>Preview how it looks embedded</summary>
              {embedPreviewOpen ? (
                <iframe
                  src={embedArtifacts.portableUrl}
                  title="Embed preview"
                  className="embed-preview-frame"
                  style={{ height: Math.min(embedIframeHeight, 640) }}
                  loading="lazy"
                />
              ) : null}
            </details>
          </div>
        ) : null}

        <SectionNav
          sections={visibleNavSections}
          organizeOpen={organizeOpen}
          showSections={resume.meta.documentOptions.showSections}
          sectionOrder={resume.meta.documentOptions.sectionOrder}
          onToggleSection={toggleSectionVisibility}
          onMoveSection={moveSectionOrder}
          onSelect={(id) => scrollTo(id as SectionId)}
          onOrganizeToggle={() => { setOrganizeOpen((o) => !o); setFormatOpen(false) }}
          onOrganizeClose={() => setOrganizeOpen(false)}
          formatSheet={
            <DocumentOptionsSection
              options={resume.meta.documentOptions}
              template={resume.meta.template}
              onTemplateChange={(template) => setResume((p) => ({ ...p, meta: { ...p.meta, template } }))}
              onChange={(documentOptions) => setResume((p) => ({ ...p, meta: { ...p.meta, documentOptions } }))}
            />
          }
          formatOpen={formatOpen}
          onFormatToggle={() => { setFormatOpen((f) => !f); setOrganizeOpen(false) }}
          onFormatClose={() => setFormatOpen(false)}
        />

        <div id="section-basics" tabIndex={-1} className={sectionCls('basics')} onMouseDownCapture={() => setActiveSection('basics')} onFocusCapture={() => setActiveSection('basics')}
>
          <BasicsSection
            basics={resume.basics}
            linkDisplay={resume.meta.documentOptions.linkDisplay}
            onLinkDisplayChange={(linkDisplay) =>
              setResume((p) => ({
                ...p,
                meta: {
                  ...p.meta,
                  documentOptions: {
                    ...p.meta.documentOptions,
                    linkDisplay,
                  },
                },
              }))
            }
            onChange={(basics) => setResume((p) => ({ ...p, basics }))}
          />
        </div>
        {orderedFormSections.map(({ key, node }) => (
          <div
            key={key}
            id={`section-${key}`}
            tabIndex={-1}
            className={sectionCls(key as SectionId)}
            onMouseDownCapture={() => setActiveSection(key as SectionId)}
            onFocusCapture={() => setActiveSection(key as SectionId)}
          >
            {node}
          </div>
        ))}
      </section>
      ) : null}

      {!isMobileLayout || mobileView === 'preview' ? (
      <section className={`right-pane panel ${isMobileLayout ? 'mobile-pane-enter' : ''}`}>
        <div className="preview-head">
          <div className="preview-head-main">
            <IconEye size={16} />
            <span className="section-title">Preview</span>
            <span
              className={`page-indicator${isPageEstimateStale ? ' stale' : ''}${isPageEstimating ? ' estimating' : ''}`}
              title={pageIndicatorTitle}
            >
              {pageIndicatorText}
            </span>
            <span className={`save-indicator ${saveState}`} title="Draft status" role="status" aria-live="polite">
              {saveStatusText}
            </span>
          </div>
          <div className="preview-head-actions">
            <div className="toolbar-strip toolbar-strip-right">
              <button type="button" className="tool-btn" title="Import resume JSON" aria-label="Import resume JSON" onClick={() => fileRef.current?.click()}><IconUpload size={14} /></button>
              <div className="export-menu" ref={exportRef}>
                <button type="button" className="tool-btn" title="Export resume" aria-label="Export resume" aria-expanded={exportOpen} onClick={() => setExportOpen((o) => !o)} disabled={busy}>
                  <IconDownload size={14} /><IconChevronDown size={10} />
                </button>
                {exportOpen ? (
                  <div className="export-dropdown">
                    <button type="button" disabled={busy} onClick={async () => { await onDownloadPdf(); setExportOpen(false) }}><IconFileText size={14} /> PDF</button>
                    <button type="button" disabled={busy} onClick={async () => { await onDownloadDocx(); setExportOpen(false) }}><IconFileText size={14} /> DOCX</button>
                    <button type="button" onClick={() => { onDownloadJson(); setExportOpen(false) }}><IconBraces size={14} /> JSON</button>
                  </div>
                ) : null}
              </div>
              <div
                className={`score-hover-wrap${openPopover === 'score' ? ' is-open' : ''}`}
                ref={scoreZoneRef}
              >
                <button
                  type="button"
                  className="score-pill"
                  title={qualityScoreLabel}
                  aria-label={qualityScoreLabel}
                  aria-controls="scoring-rubric"
                  aria-expanded={openPopover === 'score'}
                  onClick={() => setOpenPopover((p) => (p === 'score' ? null : 'score'))}
                >
                  {qualityScoreLabel}
                </button>
                <div id="scoring-rubric" className="score-help-popover" role="group" aria-label="Scoring rubric" aria-hidden={openPopover !== 'score'}>
                  <p className="score-help-title">Scoring Rubric</p>
                  <ul>
                    <li><strong>Quality:</strong> starts at 100 and deducts for errors and warnings</li>
                    <li><strong>Completeness:</strong> shown in the readiness strip above</li>
                    <li><strong>Tip:</strong> use readiness to track section progress</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="resume-preview-canvas">
          <TemplateRenderer resume={resume} />
        </div>
      </section>
      ) : null}
    </main>
  )
}
