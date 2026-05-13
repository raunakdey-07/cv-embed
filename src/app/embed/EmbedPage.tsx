import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TemplateRenderer } from '../../components/templates/TemplateRenderer'
import { loadEmbedResume } from '../../lib/storage'
import { decodeResumeFromUrl } from '../../lib/utils'
import { validateResume } from '../../schema/validators'
import type { TemplateName } from '../../types/resume'

type EmbedMode = 'preview' | 'guided' | 'edit'

interface StructuredIssue {
  severity: 'error' | 'warning'
  section: string
  code: string
  message: string
}

const EMBED_VERSION = '2'

function inferIssueSection(message: string): string {
  const value = message.toLowerCase()
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

function inferIssueCode(message: string): string {
  const value = message.toLowerCase()
  if (value.includes('required')) return 'required'
  if (value.includes('http')) return 'invalid-url'
  if (value.includes('duplicate')) return 'duplicate'
  if (value.includes('at least')) return 'minimum'
  if (value.includes('more than')) return 'max-items'
  if (value.includes('exceeds')) return 'max-length'
  if (value.includes('overflow')) return 'overflow-risk'
  return 'rule'
}

function toStructuredIssues(errors: string[], warnings: string[]): StructuredIssue[] {
  const withMeta = (severity: 'error' | 'warning', message: string): StructuredIssue => ({
    severity,
    section: inferIssueSection(message),
    code: inferIssueCode(message),
    message,
  })

  return [
    ...errors.map((message) => withMeta('error', message)),
    ...warnings.map((message) => withMeta('warning', message)),
  ]
}

function normalizeTargetOrigin(value: string): string {
  if (value === '*') return '*'
  try {
    return new URL(value).origin
  } catch {
    return '*'
  }
}

export function EmbedPage() {
  const { resumeId } = useParams()
  const [searchParams] = useSearchParams()
  const rootRef = useRef<HTMLElement>(null)

  const showDownload = searchParams.get('showDownload') !== '0' && searchParams.get('disableDownload') !== '1'
  const primaryColor = searchParams.get('primaryColor') ?? '#111111'
  const density = searchParams.get('density') === 'compact' ? 'compact' : 'normal'
  const mode: EmbedMode = searchParams.get('mode') === 'guided' ? 'guided' : searchParams.get('mode') === 'edit' ? 'edit' : 'preview'
  const debugMode = searchParams.get('debug') === '1'
  const eventOrigin = normalizeTargetOrigin(searchParams.get('eventOrigin') ?? '*')
  const embedId = searchParams.get('embedId') ?? 'standalone'
  const sdkVersion = searchParams.get('sdkVersion') ?? 'direct'
  const lockedTemplateParam = searchParams.get('lockedTemplate')
  const lockedTemplate: TemplateName | null = lockedTemplateParam === 'minimal' || lockedTemplateParam === 'compact'
    ? lockedTemplateParam
    : null
  const readOnlySections = (searchParams.get('readOnlySections') ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  const fontScale = Math.max(0.9, Math.min(1.25, Number(searchParams.get('fontScale') ?? '1') || 1))
  const radius = Math.max(4, Math.min(14, Number(searchParams.get('radius') ?? '8') || 8))

  const resume = useMemo(() => {
    const encodedData = searchParams.get('data')
    if (encodedData) {
      const decoded = decodeResumeFromUrl(encodedData)
      if (decoded) {
        return decoded
      }
    }

    if (!resumeId) {
      return null
    }

    const loaded = loadEmbedResume(resumeId)
    if (!loaded) return null

    if (lockedTemplate) {
      return {
        ...loaded,
        meta: {
          ...loaded.meta,
          template: lockedTemplate,
        },
      }
    }

    return loaded
  }, [lockedTemplate, resumeId, searchParams])

  const validation = useMemo(() => (resume ? validateResume(resume) : null), [resume])

  const structuredIssues = useMemo(() => {
    if (!validation) return []
    return toStructuredIssues(validation.errors, validation.warnings)
  }, [validation])

  const primaryGuidance = useMemo(() => {
    if (!validation) return 'Resume data loaded.'
    const issue = structuredIssues[0]
    if (!issue) return 'No blocking issues. Improve measurable outcomes for stronger impact.'
    return `Prioritize ${issue.section}: ${issue.message}`
  }, [structuredIssues, validation])

  const postBridgeEvent = useCallback((event: 'ready' | 'heightChange' | 'validationChange' | 'export' | 'sectionFocus', payload: Record<string, unknown>) => {
    if (window.parent === window) {
      return
    }

    const message = {
      source: 'cv-embed' as const,
      version: EMBED_VERSION,
      event,
      embedId,
      payload,
    }

    window.parent.postMessage(message, eventOrigin)
  }, [embedId, eventOrigin])

  useEffect(() => {
    if (!resume || !validation) return
    postBridgeEvent('ready', {
      mode,
      sdkVersion,
      resumeId: resumeId ?? 'portable',
      showDownload,
      readOnlySections,
      lockedTemplate: lockedTemplate ?? null,
      score: validation.score,
      qualityScore: validation.qualityScore,
      completenessScore: validation.completenessScore,
      template: resume.meta.template,
    })
  }, [lockedTemplate, mode, postBridgeEvent, readOnlySections, resume, resumeId, sdkVersion, showDownload, validation])

  useEffect(() => {
    if (!validation) return
    postBridgeEvent('validationChange', {
      score: validation.score,
      qualityScore: validation.qualityScore,
      completenessScore: validation.completenessScore,
      valid: validation.valid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      issues: structuredIssues,
      primaryGuidance,
    })
  }, [postBridgeEvent, primaryGuidance, structuredIssues, validation])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let frame = 0
    const publishHeight = () => {
      if (frame) {
        return
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const height = Math.ceil(document.documentElement.scrollHeight)
        postBridgeEvent('heightChange', { height })
      })
    }

    const observer = new ResizeObserver(() => publishHeight())
    observer.observe(root)
    window.addEventListener('resize', publishHeight)
    publishHeight()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', publishHeight)
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [postBridgeEvent])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const sections = root.querySelectorAll<HTMLElement>('.resume-template section')
    if (sections.length === 0) return

    const seen = new Set<string>()
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.55) return
        const label = entry.target.querySelector('h2')?.textContent?.trim() ?? 'section'
        if (seen.has(label)) return
        seen.add(label)
        postBridgeEvent('sectionFocus', { section: label })
      })
    }, { threshold: [0.55] })

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [postBridgeEvent, resume])

  if (!resume) {
    return (
      <main className="app-main single-pane">
        <section className="panel">
          <h2>Resume not found</h2>
          <p>This embed payload is missing or invalid.</p>
        </section>
      </main>
    )
  }

  return (
    <main
      ref={rootRef}
      className="app-main single-pane embed-host"
      style={{ '--embed-font-scale': String(fontScale), '--embed-radius': `${radius}px` } as CSSProperties}
    >
      {mode === 'guided' ? (
        <section className="panel embed-guidance">
          <strong>Guided mode</strong>
          <p>{primaryGuidance}</p>
        </section>
      ) : null}
      {debugMode ? (
        <section className="panel embed-debug">
          <p><strong>Embed Debug</strong> v{EMBED_VERSION}</p>
          <p>Mode: {mode} | SDK: {sdkVersion}</p>
          <p>Read-only sections: {readOnlySections.length > 0 ? readOnlySections.join(', ') : 'none'}</p>
          <p>Bridge: postMessage active</p>
        </section>
      ) : null}
      <section className="panel">
        <TemplateRenderer resume={resume} primaryColor={primaryColor} density={density} />
        {showDownload ? (
          <a
            className="link-button"
            href="/builder"
            target="_blank"
            rel="noreferrer"
            onClick={() => postBridgeEvent('export', { action: mode === 'edit' ? 'open-builder-edit' : 'open-builder' })}
          >
            {mode === 'edit' ? 'Open Editable Builder' : 'Open in Builder'}
          </a>
        ) : null}
      </section>
    </main>
  )
}
