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
import { VolunteeringSection } from '../../components/sections/Volunteering'
import { TemplateRenderer } from '../../components/templates/TemplateRenderer'
import {
  IconAlertTriangle, IconAward, IconBraces, IconBriefcase, IconCheck,
  IconChevronDown, IconCode, IconCopy, IconDownload, IconExternalLink,
  IconEye, IconFileText, IconFlag, IconGraduationCap, IconLink,
  IconSliders, IconTrophy, IconUpload, IconUser, IconZap,
} from '../../components/ui/Icons'
import { encodeResumeForUrl, normalizeResume } from '../../lib/utils'
import { loadDraft, saveDraft } from '../../lib/storage'
import { resolveNextActionSection } from '../../lib/nextAction'
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

  const stored = normalizeBaseUrl(localStorage.getItem('cv-embed:public-base-url') ?? '')
  if (stored) {
    return stored
  }

  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(window.location.hostname)) {
    return 'https://cv-embed.vercel.app'
  }

  return normalizeBaseUrl(window.location.origin)
}

function buildEmbedArtifacts(baseUrl: string, resume: Resume, options: EmbedBuildOptions): EmbedArtifacts {
  const origin = normalizeBaseUrl(baseUrl) || getDefaultEmbedBaseUrl()
  const encoded = encodeResumeForUrl(resume)
  const portable = new URL('/embed/portable', origin)
  portable.searchParams.set('data', encoded)
  if (!options.showDownload) {
    portable.searchParams.set('showDownload', '0')
  }
  const portableUrl = portable.toString()
  const sdkUrl = `${origin}/sdk.js?v=2`
  const iframeSnippet = `<iframe src="${portableUrl}" width="100%" height="${options.iframeHeight}" frameborder="0" loading="lazy" title="Resume"></iframe>`
  const sdkSnippet = `<script src="${sdkUrl}"></script>\n<div id="resume-container"></div>\n<script>\n  const embed = CVEmbed.render({\n    target: '#resume-container',\n    baseUrl: '${origin}',\n    resumeData: ${JSON.stringify(resume, null, 2)},\n    height: ${options.iframeHeight},\n    theme: { density: 'compact', fontScale: 1, radius: 8 },\n    options: {\n      showDownload: ${options.showDownload ? 'true' : 'false'},\n      autoHeight: true,\n      mode: 'guided',\n      eventTargetOrigin: window.location.origin\n    },\n    events: {\n      onReady: (payload) => console.log('cv-embed ready', payload),\n      onValidationChange: (payload) => console.log('cv-embed validation', payload),\n      onHeightChange: ({ height }) => console.log('cv-embed height', height)\n    }\n  });\n</script>`
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
    '',
    'Event API emitted by iframe:',
    '- ready',
    '- heightChange',
    '- validationChange',
    '- sectionFocus',
    '- export',
  ].join('\n')
  return { portableUrl, iframeSnippet, sdkSnippet, reactSnippet, integrationPack }
}

type SectionId =
  | 'basics' | 'education' | 'experience' | 'projects'
  | 'skills' | 'certifications' | 'accomplishments' | 'activities' | 'volunteering' | 'publications'
  | 'document-options'

const SECTION_NAV: { id: SectionId; Icon: (p: { size?: number }) => React.ReactNode; label: string }[] = [
  { id: 'basics', Icon: IconUser, label: 'Basics' },
  { id: 'document-options', Icon: IconSliders, label: 'Format' },
  { id: 'education', Icon: IconGraduationCap, label: 'Education' },
  { id: 'experience', Icon: IconBriefcase, label: 'Experience' },
  { id: 'projects', Icon: IconCode, label: 'Projects' },
  { id: 'skills', Icon: IconZap, label: 'Skills' },
  { id: 'certifications', Icon: IconAward, label: 'Certs' },
  { id: 'accomplishments', Icon: IconTrophy, label: 'Awards' },
  { id: 'activities', Icon: IconFlag, label: 'Activities' },
  { id: 'volunteering', Icon: IconFlag, label: 'Volunteer' },
  { id: 'publications', Icon: IconFileText, label: 'Publications' },
]

const SECTION_LABELS: Record<SectionId, string> = {
  basics: 'Basics',
  'document-options': 'Format',
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

function getSectionFromIssue(issue: string): SectionId {
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

function downloadJson(resume: Resume): void {
  const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'resume.json'
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

const DRAFT_SAVE_DEBOUNCE_MS = 900

export function BuilderPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const popoverZoneRef = useRef<HTMLDivElement>(null)
  const pageCountCacheRef = useRef<Map<string, number>>(new Map())
  const pageCountJobRef = useRef(0)
  const pageCountDelayTimerRef = useRef<number | null>(null)
  const pageCountIdleHandleRef = useRef<number | null>(null)

  const [resume, setResume] = useState<Resume>(() => loadDraft() ?? createEmptyResume())
  const [embedArtifacts, setEmbedArtifacts] = useState<EmbedArtifacts | null>(null)
  const [busy, setBusy] = useState(false)
  const [copyState, setCopyState] = useState('')
  const [activeSection, setActiveSection] = useState<SectionId>('basics')
  const [exportOpen, setExportOpen] = useState(false)
  const [openPopover, setOpenPopover] = useState<'info' | 'fixNext' | 'clean' | 'score' | null>(null)
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const scoreZoneRef = useRef<HTMLDivElement>(null)
  const [estimatedPages, setEstimatedPages] = useState(1)
  const [isPageEstimateStale, setIsPageEstimateStale] = useState(false)
  const [isPageEstimating, setIsPageEstimating] = useState(false)
  const [lastEstimateDurationMs, setLastEstimateDurationMs] = useState<number | null>(null)
  const [lastEstimateSource, setLastEstimateSource] = useState<'blank' | 'cache' | 'idle' | 'urgent' | null>(null)
  const [lastEstimateUpdatedAt, setLastEstimateUpdatedAt] = useState<number | null>(null)
  const [embedBaseUrl, setEmbedBaseUrl] = useState<string>(() => getDefaultEmbedBaseUrl())
  const [embedPreset, setEmbedPreset] = useState<EmbedPreset>('placement')
  const [embedIframeHeight, setEmbedIframeHeight] = useState(1100)
  const [embedShowDownload, setEmbedShowDownload] = useState(false)
  const isEmbedPanelOpen = embedArtifacts !== null
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [saveState, setSaveState] = useState<'saving' | 'saved'>('saved')
  const [savedAt, setSavedAt] = useState<number>(() => Date.now())
  const [relativeNow, setRelativeNow] = useState<number>(() => Date.now())

  useEffect(() => {
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      saveDraft({ ...resume, meta: { ...resume.meta, updatedAt: new Date().toISOString() } })
      setSavedAt(Date.now())
      setSaveState('saved')
    }, DRAFT_SAVE_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [resume])

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
    localStorage.setItem('cv-embed:public-base-url', normalizeBaseUrl(embedBaseUrl))
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
    setEmbedArtifacts(buildEmbedArtifacts(embedBaseUrl, resume, {
      iframeHeight: embedIframeHeight,
      showDownload: embedShowDownload,
    }))
  }, [isEmbedPanelOpen, embedBaseUrl, resume, embedIframeHeight, embedShowDownload])

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

    if (isBlankResume(resume)) {
      setEstimatedPages(1)
      setLastEstimateDurationMs(0)
      setLastEstimateSource('blank')
      setLastEstimateUpdatedAt(Date.now())
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
          setEstimatedPages(cached)
          setLastEstimateDurationMs(0)
          setLastEstimateSource('cache')
          setLastEstimateUpdatedAt(Date.now())
          setIsPageEstimateStale(false)
          setIsPageEstimating(false)
          return
        }

        const jobId = pageCountJobRef.current + 1
        pageCountJobRef.current = jobId
        const perfLabel = `cv-embed-page-estimate-${jobId}`
        const startedAt = performance.now()
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
          const duration = Math.max(0, Math.round(performance.now() - startedAt))

          setEstimatedPages(count)
          setLastEstimateDurationMs(duration)
          setLastEstimateSource(priority)
          setLastEstimateUpdatedAt(Date.now())
          setIsPageEstimateStale(false)
          setIsPageEstimating(false)

          performance.clearMarks(`${perfLabel}-start`)
          performance.clearMarks(`${perfLabel}-end`)
          performance.clearMeasures(perfLabel)
        } catch {
          if (pageCountJobRef.current === jobId) {
            setIsPageEstimateStale(false)
            setIsPageEstimating(false)
          }
          return
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
    // On the mobile layout the preview sits below the form, so a background
    // page estimate would pull in the ~1.5 MB PDF engine for data most users
    // never look at while filling the form. Estimate only on demand there.
    if (isMobileLayout) return
    schedulePageEstimate('idle')
    return () => clearScheduledPageCount()
  }, [clearScheduledPageCount, isMobileLayout, schedulePageEstimate])

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

  const nextIssueSection = useMemo(() => {
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

    const sectionCompletion = {
      summary: hasText(resume.basics.summary),
      education: resume.education.some((item) => [item.institution, item.degree, item.field].some(hasText)),
      experience: resume.experience.some((item) => [item.company, item.role, item.location].some(hasText) || item.bullets.some(hasText)),
      projects: resume.projects.some((item) => [item.title, item.projectLink, item.repoLink].some(hasText) || item.techStack.some(hasText) || item.bullets.some(hasText)),
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

    const basicsCoreReady = hasText(resume.basics.name) && hasText(resume.basics.email) && hasText(resume.basics.phone)
    const essentialsChecks = [
      basicsCoreReady,
      sectionCompletion.education,
      sectionCompletion.experience || sectionCompletion.projects,
      uniqueSkillCount >= 3,
      sectionCompletion.accomplishments,
    ]

    const firstMissingEssentialSection: SectionId | null =
      !basicsCoreReady ? 'basics'
        : !sectionCompletion.education ? 'education'
          : !(sectionCompletion.experience || sectionCompletion.projects) ? (resume.meta.documentOptions.showSections.experience ? 'experience' : 'projects')
            : uniqueSkillCount < 3 ? 'skills'
              : !sectionCompletion.accomplishments ? 'accomplishments'
                : null

    const visibleSections = Object.entries(resume.meta.documentOptions.showSections)
      .filter(([, visible]) => visible)
      .map(([section]) => section as keyof typeof sectionCompletion)

    const blocksTotal = 1 + visibleSections.length
    const blocksDone = (basicsCoreReady ? 1 : 0) + visibleSections.filter((section) => sectionCompletion[section]).length

    const essentialsDone = essentialsChecks.filter(Boolean).length
    const essentialsTotal = essentialsChecks.length

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

  const nextActionSection = useMemo(() => {
    return resolveNextActionSection(completion.firstMissingEssentialSection, nextIssueSection)
  }, [completion.firstMissingEssentialSection, nextIssueSection])

  const fixNextTooltipText = useMemo(() => {
    if (nextActionSection) {
      return `Next action: complete ${SECTION_LABELS[nextActionSection]} first.`
    }
    return 'Next action: fix listed validation issues.'
  }, [nextActionSection])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const expected = completion.firstMissingEssentialSection ?? nextIssueSection
    if (expected !== nextActionSection) {
      console.warn('[cv-embed] next action mismatch detected', {
        expected,
        nextActionSection,
      })
    }
  }, [completion.firstMissingEssentialSection, nextActionSection, nextIssueSection])

  const saveStatusText = saveState === 'saving'
    ? 'Saving draft...'
    : `Saved ${formatRelativeTime(savedAt, relativeNow)}`

  const pageIndicatorText = isPageEstimating && isPageEstimateStale
    ? `Est. pages: ${estimatedPages}`
    : `Pages: ${estimatedPages}`

  const pageIndicatorTitle = (() => {
    if (isPageEstimating) {
      return 'Estimated A4 pages in export'
    }

    if (lastEstimateSource && typeof lastEstimateDurationMs === 'number' && lastEstimateUpdatedAt) {
      return `Estimated A4 pages in export • ${lastEstimateSource} • ${lastEstimateDurationMs}ms • updated ${formatRelativeTime(lastEstimateUpdatedAt, relativeNow)}`
    }

    return 'Estimated A4 pages in export'
  })()

  const onImportJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const next = normalizeResume(JSON.parse(await file.text()) as Resume)
      setResume(next); setEmbedArtifacts(null)
    } catch { alert('Invalid JSON') }
  }

  const createEmbedLink = useCallback(() => {
    if (embedArtifacts) {
      setEmbedArtifacts(null)
      return
    }

    setEmbedArtifacts(buildEmbedArtifacts(embedBaseUrl, resume, {
      iframeHeight: embedIframeHeight,
      showDownload: embedShowDownload,
    }))
  }, [embedArtifacts, embedBaseUrl, resume, embedIframeHeight, embedShowDownload])

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
    try {
      setBusy(true)
      const { downloadResumePdf } = await import('../../pdf/pdfRenderer')
      await downloadResumePdf(resume, `${(resume.basics.name || 'resume').replace(/\s+/g, '_')}.pdf`)
    } finally {
      setBusy(false)
    }
  }, [resume])

  const onDownloadDocx = useCallback(async () => {
    try {
      setBusy(true)
      const { downloadResumeDocx } = await import('../../docx/docxRenderer')
      await downloadResumeDocx(resume, `${(resume.basics.name || 'resume').replace(/\s+/g, '_')}.docx`)
    } finally {
      setBusy(false)
    }
  }, [resume])

  const onDownloadJson = useCallback(() => {
    downloadJson(resume)
  }, [resume])

  const copyToastTimerRef = useRef<number | null>(null)
  const copyTo = useCallback(async (label: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopyState(`${label} copied`)
    if (copyToastTimerRef.current !== null) {
      window.clearTimeout(copyToastTimerRef.current)
    }
    copyToastTimerRef.current = window.setTimeout(() => {
      copyToastTimerRef.current = null
      setCopyState('')
    }, 1800)
  }, [])

  useEffect(() => () => {
    if (copyToastTimerRef.current !== null) {
      window.clearTimeout(copyToastTimerRef.current)
    }
  }, [])

  const embedSnippetCards = embedArtifacts ? [
    {
      key: 'iframe',
      label: 'iframe',
      title: 'Portable iframe',
      description: 'Drop-in embed for portals and static sites.',
      value: embedArtifacts.iframeSnippet,
    },
    {
      key: 'react',
      label: 'react',
      title: 'React iframe',
      description: 'JSX-friendly embed for React applications.',
      value: embedArtifacts.reactSnippet,
    },
    {
      key: 'sdk',
      label: 'sdk',
      title: 'SDK bridge',
      description: 'Script block with bridge events and callbacks.',
      value: embedArtifacts.sdkSnippet,
    },
    {
      key: 'pack',
      label: 'pack',
      title: 'Integration pack',
      description: 'A single copy block with all host-facing artifacts.',
      value: embedArtifacts.integrationPack,
    },
  ] : []

  const scrollTo = (id: SectionId) => {
    setActiveSection(id)
    if (isMobileLayout) setMobileView('edit')
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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

  const jumpToFirstIssue = useCallback(() => {
    const section = nextActionSection
    if (!section) return

    setActiveSection(section)
    requestAnimationFrame(() => {
      document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [nextActionSection])

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
    <main className={`app-main two-pane ${isMobileLayout ? 'is-mobile-layout' : ''}`}>
      {isMobileLayout ? (
        <div className="mobile-view-toggle" role="tablist" aria-label="Builder view">
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'edit'}
            className={`mobile-view-tab ${mobileView === 'edit' ? 'active' : ''}`}
            onClick={() => setMobileView('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'preview'}
            className={`mobile-view-tab ${mobileView === 'preview' ? 'active' : ''}`}
            onClick={() => setMobileView('preview')}
          >
            Preview
          </button>
        </div>
      ) : null}

      {!isMobileLayout || mobileView === 'edit' ? (
      <section className={`left-pane ${isMobileLayout ? 'mobile-pane-enter' : ''}`}>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImportJson} />

        <div className="completion-strip" ref={popoverZoneRef} title="Readiness based on section coverage, essentials, and validation state">
          <div className="completion-head">
            <div className="completion-title-group">
              <div className="completion-title-row">
                <span className="completion-title">Resume Readiness</span>
                <span className="completion-inline-tools">
                  <span
                    className={`completion-info-wrap${openPopover === 'info' ? ' is-open' : ''}`}
                    tabIndex={0}
                    aria-label="Readiness details"
                  >
                    <button
                      type="button"
                      className="completion-info-btn"
                      aria-expanded={openPopover === 'info'}
                      onClick={() => setOpenPopover((p) => (p === 'info' ? null : 'info'))}
                    >i</button>
                    <span className="completion-pill-popover completion-info-popover" role="tooltip">
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
                  tabIndex={0}
                  aria-label="Issue guidance"
                >
                  <button
                    type="button"
                    className={`completion-pill completion-pill-action completion-pill-compact ${issueSummary.severity === 'errors' ? 'error' : 'warn'}`}
                    title="Jump to first essentials gap or issue (Ctrl/Cmd+Shift+J)"
                    aria-label="Fix next issue"
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
                  <div className="completion-pill-popover" role="tooltip">
                    {fixNextTooltipText}
                  </div>
                </div>
              ) : (
                <div
                  className={`completion-pill-wrap${openPopover === 'clean' ? ' is-open' : ''}`}
                  tabIndex={0}
                  aria-label="Issue guidance"
                >
                  <button
                    type="button"
                    className="completion-pill completion-pill-compact ok"
                    aria-expanded={openPopover === 'clean'}
                    onClick={() => setOpenPopover((p) => (p === 'clean' ? null : 'clean'))}
                  >
                    <IconCheck size={10} /> Clean
                  </button>
                  <div className="completion-pill-popover" role="tooltip">
                    No validation issues right now. Next action: add measurable outcomes to improve overall quality.
                  </div>
                </div>
              )}
              <span className="completion-value">{completion.percent}%</span>
            </div>
          </div>
          <div className="completion-track" aria-hidden>
            <span className="completion-fill" style={{ width: `${completion.percent}%` }} />
          </div>
        </div>

        {embedArtifacts ? (
          <div className="embed-strip">
            <div className="embed-field-row">
              <span className="embed-label">Public Base URL</span>
              <input
                className="embed-base-input"
                value={embedBaseUrl}
                onChange={(event) => setEmbedBaseUrl(event.target.value)}
                onBlur={() => setEmbedBaseUrl((current) => normalizeBaseUrl(current) || getDefaultEmbedBaseUrl())}
                placeholder="https://cv-embed.vercel.app"
              />
            </div>
            <div className="embed-config-row">
              <label className="embed-config-item embed-config-pill">
                <span className="embed-label">Preset</span>
                <select
                  className="embed-preset-select"
                  value={embedPreset}
                  onChange={(event) => onEmbedPresetChange(event.target.value as EmbedPreset)}
                >
                  <option value="placement">Placement Portal</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="showcase">Compact Showcase</option>
                  <option value="custom">Custom</option>
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
                <span className="embed-label">Download</span>
                <input
                  type="checkbox"
                  checked={embedShowDownload}
                  onChange={(event) => onEmbedDownloadChange(event.target.checked)}
                />
                <span className="embed-toggle-text">{embedShowDownload ? 'Shown' : 'Hidden'}</span>
              </label>
            </div>
            <p className="embed-tip">Use iframe for portals, React for apps, and the SDK for host-controlled bridges.</p>
            <div className="embed-link-card">
              <div className="embed-link-card-head">
                <span className="embed-label">Embed URL</span>
                <div className="embed-link-actions">
                  <a href={embedArtifacts.portableUrl} target="_blank" rel="noreferrer" className="embed-icon-btn" aria-label="Open embed URL">
                    <IconExternalLink size={11} />
                  </a>
                  <button type="button" className="embed-icon-btn" onClick={() => copyTo('Embed URL', embedArtifacts.portableUrl)} aria-label="Copy embed URL">
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
                    <button type="button" className="embed-icon-btn" onClick={() => copyTo(card.title, card.value)} aria-label={`Copy ${card.label} snippet`}>
                      <IconCopy size={11} />
                    </button>
                  </div>
                  <pre className="embed-snippet-code" title={card.value}>{card.value}</pre>
                </div>
              ))}
            </div>
            {copyState ? <span className="copy-toast"><IconCheck size={11} /> {copyState}</span> : null}
          </div>
        ) : null}

        <SectionNav
          sections={navSections}
          organizeOpen={organizeOpen}
          showSections={resume.meta.documentOptions.showSections}
          sectionOrder={resume.meta.documentOptions.sectionOrder}
          onToggleSection={toggleSectionVisibility}
          onMoveSection={moveSectionOrder}
          onSelect={(id) => scrollTo(id as SectionId)}
          onOrganizeToggle={() => setOrganizeOpen((o) => !o)}
          onOrganizeClose={() => setOrganizeOpen(false)}
        />

        <div id="section-basics" className={sectionCls('basics')} onMouseDownCapture={() => setActiveSection('basics')} onFocusCapture={() => setActiveSection('basics')}>
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
        <div id="section-document-options" className={sectionCls('document-options')} onMouseDownCapture={() => setActiveSection('document-options')} onFocusCapture={() => setActiveSection('document-options')}>
          <DocumentOptionsSection
            options={resume.meta.documentOptions}
            onChange={(documentOptions) => setResume((p) => ({ ...p, meta: { ...p.meta, documentOptions } }))}
            onToggleSection={toggleSectionVisibility}
            onMoveSection={moveSectionOrder}
          />
        </div>
        <div id="section-education" className={sectionCls('education')} onMouseDownCapture={() => setActiveSection('education')} onFocusCapture={() => setActiveSection('education')}>
          <EducationSection education={resume.education} onChange={(education) => setResume((p) => ({ ...p, education }))} />
        </div>
        <div id="section-experience" className={sectionCls('experience')} onMouseDownCapture={() => setActiveSection('experience')} onFocusCapture={() => setActiveSection('experience')}>
          <ExperienceSection experience={resume.experience} onChange={(experience) => setResume((p) => ({ ...p, experience }))} />
        </div>
        <div id="section-projects" className={sectionCls('projects')} onMouseDownCapture={() => setActiveSection('projects')} onFocusCapture={() => setActiveSection('projects')}>
          <ProjectsSection projects={resume.projects} onChange={(projects) => setResume((p) => ({ ...p, projects }))} />
        </div>
        <div id="section-skills" className={sectionCls('skills')} onMouseDownCapture={() => setActiveSection('skills')} onFocusCapture={() => setActiveSection('skills')}>
          <SkillsSection skills={resume.skills} onChange={(skills) => setResume((p) => ({ ...p, skills }))} />
        </div>
        <div id="section-certifications" className={sectionCls('certifications')} onMouseDownCapture={() => setActiveSection('certifications')} onFocusCapture={() => setActiveSection('certifications')}>
          <CertificationsSection certifications={resume.certifications} onChange={(certifications) => setResume((p) => ({ ...p, certifications }))} />
        </div>
        <div id="section-accomplishments" className={sectionCls('accomplishments')} onMouseDownCapture={() => setActiveSection('accomplishments')} onFocusCapture={() => setActiveSection('accomplishments')}>
          <AccomplishmentsSection accomplishments={resume.accomplishments} onChange={(accomplishments) => setResume((p) => ({ ...p, accomplishments }))} />
        </div>
        <div id="section-activities" className={sectionCls('activities')} onMouseDownCapture={() => setActiveSection('activities')} onFocusCapture={() => setActiveSection('activities')}>
          <ActivitiesSection activities={resume.activities} onChange={(activities) => setResume((p) => ({ ...p, activities }))} />
        </div>
        <div id="section-volunteering" className={sectionCls('volunteering')} onMouseDownCapture={() => setActiveSection('volunteering')} onFocusCapture={() => setActiveSection('volunteering')}>
          <VolunteeringSection volunteering={resume.volunteering} onChange={(volunteering) => setResume((p) => ({ ...p, volunteering }))} />
        </div>
        <div id="section-publications" className={sectionCls('publications')} onMouseDownCapture={() => setActiveSection('publications')} onFocusCapture={() => setActiveSection('publications')}>
          <PublicationsSection publications={resume.publications} onChange={(publications) => setResume((p) => ({ ...p, publications }))} />
        </div>
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
            <span className={`save-indicator ${saveState === 'saving' ? 'saving' : 'saved'}`} title="Draft status">
              {saveStatusText}
            </span>
          </div>
          <div className="preview-head-actions">
            <div className="toolbar-strip toolbar-strip-right">
              <button
                type="button"
                className="tool-btn"
                title={embedArtifacts ? 'Hide embed panel' : 'Show embed panel'}
                onClick={createEmbedLink}
              >
                <IconLink size={14} />
              </button>
              <button type="button" className="tool-btn" title="Import resume JSON" onClick={() => fileRef.current?.click()}><IconUpload size={14} /></button>
              <div className="export-menu" ref={exportRef}>
                <button type="button" className="tool-btn" title="Export resume" onClick={() => setExportOpen((o) => !o)} disabled={busy}>
                  <IconDownload size={14} /><IconChevronDown size={10} />
                </button>
                {exportOpen ? (
                  <div className="export-dropdown">
                    <button type="button" onClick={async () => { await onDownloadPdf(); setExportOpen(false) }}><IconFileText size={14} /> PDF</button>
                    <button type="button" onClick={async () => { await onDownloadDocx(); setExportOpen(false) }}><IconFileText size={14} /> DOCX</button>
                    <button type="button" onClick={() => { onDownloadJson(); setExportOpen(false) }}><IconBraces size={14} /> JSON</button>
                  </div>
                ) : null}
              </div>
              <div
                className={`score-hover-wrap${openPopover === 'score' ? ' is-open' : ''}`}
                ref={scoreZoneRef}
                tabIndex={0}
                aria-label="Scoring rubric"
              >
                <button
                  type="button"
                  className="score-pill"
                  title={qualityScoreLabel}
                  aria-expanded={openPopover === 'score'}
                  onClick={() => setOpenPopover((p) => (p === 'score' ? null : 'score'))}
                >
                  {qualityScoreLabel}
                </button>
                <div className="score-help-popover" role="dialog" aria-label="Scoring rubric">
                  <p className="score-help-title">Scoring Rubric</p>
                  <ul>
                    <li><strong>Quality:</strong> errors, warnings, and writing signals</li>
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
