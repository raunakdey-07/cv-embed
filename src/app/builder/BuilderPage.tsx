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
  IconSliders, IconTrophy, IconUpload, IconUser, IconXCircle, IconZap,
} from '../../components/ui/Icons'
import { encodeResumeForUrl, normalizeResume } from '../../lib/utils'
import { loadDraft, saveDraft } from '../../lib/storage'
import { validateResume } from '../../schema/validators'
import { createEmptyResume, type Resume } from '../../types/resume'


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

function buildEmbedArtifacts(baseUrl: string, resume: Resume): EmbedArtifacts {
  const origin = normalizeBaseUrl(baseUrl) || getDefaultEmbedBaseUrl()
  const encoded = encodeResumeForUrl(resume)
  const portable = new URL('/embed/portable', origin)
  portable.searchParams.set('data', encoded)
  const portableUrl = portable.toString()
  const iframeSnippet = `<iframe src="${portableUrl}" width="100%" height="1100" frameborder="0"></iframe>`
  const sdkSnippet = `<script src="${origin}/sdk.js"></script>\n<div id="resume-container"></div>\n<script>\n  CVEmbed.render({\n    target: '#resume-container',\n    baseUrl: '${origin}',\n    resumeData: ${JSON.stringify(resume, null, 2)},\n    options: { showDownload: false }\n  });\n</script>`
  return { portableUrl, iframeSnippet, sdkSnippet }
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

interface EmbedArtifacts {
  portableUrl: string
  iframeSnippet: string
  sdkSnippet: string
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

export function BuilderPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const scoreGuideRef = useRef<HTMLDivElement>(null)
  const mobileActionsRef = useRef<HTMLDivElement>(null)

  const [resume, setResume] = useState<Resume>(() => loadDraft() ?? createEmptyResume())
  const [embedArtifacts, setEmbedArtifacts] = useState<EmbedArtifacts | null>(null)
  const [busy, setBusy] = useState(false)
  const [copyState, setCopyState] = useState('')
  const [activeSection, setActiveSection] = useState<SectionId>('basics')
  const [exportOpen, setExportOpen] = useState(false)
  const [mobileExportOpen, setMobileExportOpen] = useState(false)
  const [scoreGuideOpen, setScoreGuideOpen] = useState(false)
  const [estimatedPages, setEstimatedPages] = useState(1)
  const [embedBaseUrl, setEmbedBaseUrl] = useState<string>(() => getDefaultEmbedBaseUrl())
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [saveState, setSaveState] = useState<'saving' | 'saved'>('saved')
  const [savedAt, setSavedAt] = useState<number>(() => Date.now())
  const [relativeNow, setRelativeNow] = useState<number>(() => Date.now())

  useEffect(() => {
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      saveDraft({ ...resume, meta: { ...resume.meta, updatedAt: new Date().toISOString() } })
      setSavedAt(Date.now())
      setSaveState('saved')
    }, 220)

    return () => window.clearTimeout(timer)
  }, [resume])

  useEffect(() => {
    const timer = window.setInterval(() => setRelativeNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
      if (scoreGuideRef.current && !scoreGuideRef.current.contains(e.target as Node)) setScoreGuideOpen(false)
      if (mobileActionsRef.current && !mobileActionsRef.current.contains(e.target as Node)) setMobileExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem('cv-embed:public-base-url', normalizeBaseUrl(embedBaseUrl))
  }, [embedBaseUrl])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches)
      if (!event.matches) {
        setMobileView('edit')
        setMobileExportOpen(false)
      }
    }

    setIsMobileLayout(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!embedArtifacts) return
    setEmbedArtifacts(buildEmbedArtifacts(embedBaseUrl, resume))
  }, [embedArtifacts, embedBaseUrl, resume])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const { countPdfPages } = await import('../../pdf/pdfRenderer')
        const count = await countPdfPages(resume)
        if (!cancelled) setEstimatedPages(count)
      } catch {
        return
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [resume])

  const validation = useMemo(() => validateResume(resume), [resume])

  const completion = useMemo(() => {
    const hasText = (value: string) => value.trim().length > 0
    const skills = [
      ...resume.skills.languages,
      ...resume.skills.frameworks,
      ...resume.skills.tools,
      ...resume.skills.other,
    ]
    const uniqueSkillCount = new Set(skills.map((value) => value.trim().toLowerCase()).filter(Boolean)).size

    const checks = [
      hasText(resume.basics.name) && hasText(resume.basics.email) && hasText(resume.basics.phone),
      hasText(resume.basics.summary),
      resume.education.some((item) => [item.institution, item.degree, item.field].some(hasText)),
      resume.experience.some((item) => [item.company, item.role].some(hasText) || item.bullets.some(hasText)),
      resume.projects.some((item) => [item.title, item.projectLink, item.repoLink].some(hasText) || item.bullets.some(hasText)),
      uniqueSkillCount >= 3,
      resume.basics.links.some((item) => hasText(item.url)),
    ]

    const done = checks.filter(Boolean).length
    const total = checks.length
    return {
      done,
      total,
      percent: Math.round((done / total) * 100),
    }
  }, [resume])

  const saveStatusText = saveState === 'saving'
    ? 'Saving draft...'
    : `Saved ${formatRelativeTime(savedAt, relativeNow)}`

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

    setEmbedArtifacts(buildEmbedArtifacts(embedBaseUrl, resume))
  }, [embedArtifacts, embedBaseUrl, resume])

  const onToggleMobileView = useCallback(() => {
    setMobileView((view) => (view === 'edit' ? 'preview' : 'edit'))
    setMobileExportOpen(false)
  }, [])

  const onDownloadPdf = useCallback(async () => {
    try {
      setBusy(true)
      const { downloadResumePdf } = await import('../../pdf/pdfRenderer')
      await downloadResumePdf(resume, `${(resume.basics.name || 'resume').replace(/\s+/g, '_')}.pdf`)
      if (isMobileLayout) setMobileView('preview')
      setMobileExportOpen(false)
    } finally {
      setBusy(false)
    }
  }, [isMobileLayout, resume])

  const onDownloadDocx = useCallback(async () => {
    try {
      setBusy(true)
      const { downloadResumeDocx } = await import('../../docx/docxRenderer')
      await downloadResumeDocx(resume, `${(resume.basics.name || 'resume').replace(/\s+/g, '_')}.docx`)
      if (isMobileLayout) setMobileView('preview')
      setMobileExportOpen(false)
    } finally {
      setBusy(false)
    }
  }, [isMobileLayout, resume])

  const onDownloadJson = useCallback(() => {
    downloadJson(resume)
    if (isMobileLayout) setMobileView('preview')
    setMobileExportOpen(false)
  }, [isMobileLayout, resume])

  const copyTo = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopyState(`${label} copied`)
    setTimeout(() => setCopyState(''), 1800)
  }

  const scrollTo = (id: SectionId) => {
    setActiveSection(id)
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const sectionCls = (id: SectionId) =>
    `section-shell ${activeSection === id ? 'is-active' : 'is-compact'}`

  const jumpToFirstIssue = useCallback(() => {
    const issue = validation.errors[0] ?? validation.warnings[0]
    if (!issue) return

    const section = getSectionFromIssue(issue)
    if (isMobileLayout) {
      setMobileView('edit')
    }

    setActiveSection(section)
    requestAnimationFrame(() => {
      document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [isMobileLayout, validation.errors, validation.warnings])

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

      if (event.shiftKey && key === 'p' && isMobileLayout) {
        event.preventDefault()
        onToggleMobileView()
        return
      }

      if (event.shiftKey && key === 'j') {
        event.preventDefault()
        jumpToFirstIssue()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [busy, createEmbedLink, isMobileLayout, jumpToFirstIssue, onToggleMobileView, onDownloadPdf])

  const showEditPane = !isMobileLayout || mobileView === 'edit'
  const showPreviewPane = !isMobileLayout || mobileView === 'preview'

  return (
    <main className={`app-main two-pane ${isMobileLayout ? 'is-mobile-layout' : ''}`}>
      {isMobileLayout ? (
        <div className="mobile-view-switch" role="tablist" aria-label="Mobile view switch">
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

      {showEditPane ? (
      <section className={`left-pane ${isMobileLayout ? 'mobile-pane-enter' : ''}`}>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImportJson} />

        <div className="completion-strip" title="Live section completion based on core resume blocks">
          <div className="completion-head">
            <span>Completion</span>
            <span>{completion.percent}%</span>
          </div>
          <div className="completion-track" aria-hidden>
            <span className="completion-fill" style={{ width: `${completion.percent}%` }} />
          </div>
          <div className="completion-meta">{completion.done}/{completion.total} core blocks complete</div>
        </div>

        {embedArtifacts ? (
          <div className="embed-strip">
            <div className="embed-row">
              <span className="embed-label">Public Base</span>
              <input
                className="embed-base-input"
                value={embedBaseUrl}
                onChange={(event) => setEmbedBaseUrl(event.target.value)}
                onBlur={() => setEmbedBaseUrl((current) => normalizeBaseUrl(current) || getDefaultEmbedBaseUrl())}
                placeholder="https://cv-embed.vercel.app"
              />
            </div>
            <div className="embed-row">
              <span className="embed-label">Embed URL</span>
              <span className="embed-url" title={embedArtifacts.portableUrl}>{embedArtifacts.portableUrl}</span>
              <a href={embedArtifacts.portableUrl} target="_blank" rel="noreferrer"><IconExternalLink size={11} /></a>
              <button type="button" className="tool-btn" onClick={() => copyTo('Embed URL', embedArtifacts.portableUrl)}><IconCopy size={11} /></button>
            </div>
            <div className="embed-row"><span className="embed-label">iframe</span><button type="button" className="tool-btn" onClick={() => copyTo('iframe', embedArtifacts.iframeSnippet)}><IconCopy size={11} /></button></div>
            <div className="embed-row"><span className="embed-label">sdk</span><button type="button" className="tool-btn" onClick={() => copyTo('SDK snippet', embedArtifacts.sdkSnippet)}><IconCopy size={11} /></button></div>
            {copyState ? <span className="copy-toast"><IconCheck size={11} /> {copyState}</span> : null}
          </div>
        ) : null}

        <nav className="section-nav">
          {SECTION_NAV.map((s) => (
            <button key={s.id} className={`nav-tab ${activeSection === s.id ? 'active' : ''}`} onClick={() => scrollTo(s.id)}>
              <s.Icon size={13} /><span>{s.label}</span>
            </button>
          ))}
        </nav>

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
          <DocumentOptionsSection options={resume.meta.documentOptions} onChange={(documentOptions) => setResume((p) => ({ ...p, meta: { ...p.meta, documentOptions } }))} />
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

      {showPreviewPane ? (
      <section className={`right-pane panel ${isMobileLayout ? 'mobile-pane-enter' : ''}`}>
        <div className="preview-head">
          <div className="preview-head-main">
            <IconEye size={16} />
            <span className="section-title">Preview</span>
            <span className="page-indicator" title="Estimated A4 pages in export">Pages: {estimatedPages}</span>
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
              <div className="toolbar-sep" />
              {(validation.errors.length > 0 || validation.warnings.length > 0) ? (
                <button
                  type="button"
                  className="tool-btn jump-issue-btn"
                  title="Jump to first issue (Ctrl/Cmd+Shift+J)"
                  onClick={jumpToFirstIssue}
                >
                  <IconAlertTriangle size={12} /> Fix first
                </button>
              ) : null}
              <div className={`status-dot ${validation.valid ? 'valid' : 'invalid'}`} title={validation.valid ? 'Validation: no errors' : `Validation errors:\n${validation.errors.join('\n')}`}>
                {validation.valid ? <IconCheck size={12} /> : <IconXCircle size={12} />}
              </div>
              <span className="score-pill" title="Validation score out of 100">Score: {validation.score}/100</span>
              <div className="score-help-wrap" ref={scoreGuideRef}>
                <button
                  type="button"
                  className="score-help-btn"
                  title="View scoring rubric"
                  onClick={() => setScoreGuideOpen((open) => !open)}
                >
                  ?
                </button>
                {scoreGuideOpen ? (
                  <div className="score-help-popover" role="dialog" aria-label="Scoring rubric">
                    <p className="score-help-title">Scoring Rubric</p>
                    <ul>
                      <li><strong>Projects:</strong> at least 1 required</li>
                      <li><strong>Skills:</strong> 3+ distinct required</li>
                      <li><strong>Errors:</strong> high score penalty</li>
                      <li><strong>Warnings:</strong> moderate penalty</li>
                      <li><strong>Bonuses:</strong> summary, links, depth</li>
                    </ul>
                  </div>
                ) : null}
              </div>
              {validation.errors.length > 0 ? <span className="err-badge" title={`Errors:\n${validation.errors.join('\n')}`}><IconXCircle size={10} /> {validation.errors.length}</span> : null}
              {validation.warnings.length > 0 ? <span className="warn-badge" title={`Warnings:\n${validation.warnings.join('\n')}`}><IconAlertTriangle size={10} /> {validation.warnings.length}</span> : null}
            </div>
          </div>
        </div>
        <div className="resume-preview-canvas">
          <TemplateRenderer resume={resume} />
        </div>
      </section>
      ) : null}

      {isMobileLayout ? (
        <div className="mobile-bottom-actions-wrap" ref={mobileActionsRef}>
          {mobileExportOpen ? (
            <div className="mobile-export-sheet" role="menu" aria-label="Mobile export menu">
              <button type="button" onClick={onDownloadPdf}><IconFileText size={14} /> PDF</button>
              <button type="button" onClick={onDownloadDocx}><IconFileText size={14} /> DOCX</button>
              <button type="button" onClick={onDownloadJson}><IconBraces size={14} /> JSON</button>
            </div>
          ) : null}

          <div className="mobile-bottom-actions">
            <button type="button" className="mobile-bottom-btn" onClick={onToggleMobileView}>
              {mobileView === 'edit' ? <IconEye size={14} /> : <IconSliders size={14} />}
              {mobileView === 'edit' ? 'Preview' : 'Edit'}
            </button>
            <button
              type="button"
              className={`mobile-bottom-btn ${mobileExportOpen ? 'active' : ''}`}
              onClick={() => setMobileExportOpen((open) => !open)}
              disabled={busy}
            >
              <IconDownload size={14} /> Export
            </button>
            <button
              type="button"
              className={`mobile-bottom-btn ${embedArtifacts ? 'active' : ''}`}
              onClick={createEmbedLink}
            >
              <IconLink size={14} /> Embed
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
