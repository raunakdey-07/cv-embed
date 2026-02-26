import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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

interface EmbedArtifacts {
  portableUrl: string
  iframeSnippet: string
  sdkSnippet: string
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

  const [resume, setResume] = useState<Resume>(() => loadDraft() ?? createEmptyResume())
  const [embedArtifacts, setEmbedArtifacts] = useState<EmbedArtifacts | null>(null)
  const [busy, setBusy] = useState(false)
  const [copyState, setCopyState] = useState('')
  const [activeSection, setActiveSection] = useState<SectionId>('basics')
  const [exportOpen, setExportOpen] = useState(false)
  const [scoreGuideOpen, setScoreGuideOpen] = useState(false)
  const [estimatedPages, setEstimatedPages] = useState(1)
  const [embedBaseUrl, setEmbedBaseUrl] = useState<string>(() => getDefaultEmbedBaseUrl())

  useEffect(() => {
    saveDraft({ ...resume, meta: { ...resume.meta, updatedAt: new Date().toISOString() } })
  }, [resume])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
      if (scoreGuideRef.current && !scoreGuideRef.current.contains(e.target as Node)) setScoreGuideOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem('cv-embed:public-base-url', normalizeBaseUrl(embedBaseUrl))
  }, [embedBaseUrl])

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

  const onImportJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const next = normalizeResume(JSON.parse(await file.text()) as Resume)
      setResume(next); setEmbedArtifacts(null)
    } catch { alert('Invalid JSON') }
  }

  const createEmbedLink = () => {
    if (embedArtifacts) {
      setEmbedArtifacts(null)
      return
    }

    setEmbedArtifacts(buildEmbedArtifacts(embedBaseUrl, resume))
  }

  const onDownloadPdf = async () => {
    try {
      setBusy(true)
      const { downloadResumePdf } = await import('../../pdf/pdfRenderer')
      await downloadResumePdf(resume, `${(resume.basics.name || 'resume').replace(/\s+/g, '_')}.pdf`)
    } finally {
      setBusy(false)
    }
  }

  const onDownloadDocx = async () => {
    try {
      setBusy(true)
      const { downloadResumeDocx } = await import('../../docx/docxRenderer')
      await downloadResumeDocx(resume, `${(resume.basics.name || 'resume').replace(/\s+/g, '_')}.docx`)
    } finally {
      setBusy(false)
    }
  }

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

  return (
    <main className="app-main two-pane">
      <section className="left-pane">
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImportJson} />

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

      <section className="right-pane panel">
        <div className="preview-head">
          <div className="preview-head-main">
            <IconEye size={16} />
            <span className="section-title">Preview</span>
            <span className="page-indicator" title="Estimated A4 pages in export">Pages: {estimatedPages}</span>
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
                    <button type="button" onClick={() => { downloadJson(resume); setExportOpen(false) }}><IconBraces size={14} /> JSON</button>
                  </div>
                ) : null}
              </div>
              <div className="toolbar-sep" />
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
    </main>
  )
}
