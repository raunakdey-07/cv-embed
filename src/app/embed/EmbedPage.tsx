import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { TemplateRenderer } from '../../components/templates/TemplateRenderer'
import { loadEmbedResume } from '../../lib/storage'
import { decodeResumeFromUrl, getResumeDataFromUrl, normalizeResume } from '../../lib/utils'
import { resolveBuilderHandoff } from '../../lib/handoff'
import { validateResume } from '../../schema/validators'
import { EXPORT_FORMATS, PROTOCOL_VERSION, SDK_VERSION, isUnsupportedProtocol, parseHostCommand, parseHostCommandName } from '../../../sdk/protocol'
import type { Resume, TemplateName } from '../../types/resume'

type EmbedMode = 'preview' | 'guided' | 'edit'

interface StructuredIssue {
  severity: 'error' | 'warning'
  section: string
  code: string
  message: string
}

const EMBED_VERSION = PROTOCOL_VERSION

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

function normalizeTargetOrigin(value: string | null): string | null {
  if (value === '*') return '*'
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getParentOrigin(): string | null {
  if (window.parent === window) return null
  try {
    return new URL(document.referrer).origin
  } catch {
    return null
  }
}

export function EmbedPage() {
  const { resumeId } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const resumeLocation = `${location.pathname}${location.search}${location.hash}`
  const rootRef = useRef<HTMLElement>(null)
  // Host-driven overrides arrive over postMessage and win over the URL, which
  // only carries the initial configuration.
  const [hostOptions, setHostOptions] = useState<{
    primaryColor?: string | null
    density?: 'comfortable' | 'compact' | null
    showDownload?: boolean
  }>({})
  // Bumped by the syncState command to re-emit state to a late host.
  const [syncNonce, setSyncNonce] = useState(0)

  const showDownload = hostOptions.showDownload
    ?? (searchParams.get('showDownload') !== '0' && searchParams.get('disableDownload') !== '1')
  const primaryColor = hostOptions.primaryColor ?? searchParams.get('primaryColor') ?? undefined
  const density = hostOptions.density
    ?? (searchParams.has('density')
      ? searchParams.get('density') === 'compact' ? 'compact' : 'comfortable'
      : undefined)
  const mode: EmbedMode = searchParams.get('mode') === 'guided' ? 'guided' : searchParams.get('mode') === 'edit' ? 'edit' : 'preview'
  const debugMode = searchParams.get('debug') === '1'
  const eventOrigin = normalizeTargetOrigin(searchParams.get('eventOrigin')) ?? getParentOrigin()
  const embedId = searchParams.get('embedId') ?? 'standalone'
  const sdkVersion = searchParams.get('sdkVersion') ?? SDK_VERSION
  const lockedTemplateParam = searchParams.get('lockedTemplate')
  const lockedTemplate: TemplateName | null = lockedTemplateParam === 'minimal' || lockedTemplateParam === 'compact'
    ? lockedTemplateParam
    : null
  const fontScale = Math.max(0.9, Math.min(1.25, Number(searchParams.get('fontScale') ?? '1') || 1))
  const radius = Math.max(4, Math.min(14, Number(searchParams.get('radius') ?? '8') || 8))

  const initialResume = useMemo(() => {
    const encodedData = getResumeDataFromUrl(new URL(resumeLocation, window.location.origin))
    const loaded = encodedData ? decodeResumeFromUrl(encodedData) : null
    const source = loaded ?? (resumeId ? loadEmbedResume(resumeId) : null)
    if (!source) return null

    return lockedTemplate
      ? {
          ...source,
          meta: {
            ...source.meta,
            template: lockedTemplate,
          },
        }
      : source
  }, [lockedTemplate, resumeId, resumeLocation])

  // The host can replace the document over the bridge, so the rendered resume
  // is state rather than a value derived from the URL.
  const [resume, setResume] = useState<Resume | null>(initialResume)

  // The host's export route. Too large for a portable link means no handoff at
  // all: sending the visitor to a bare /builder would hand them an empty editor
  // and lose the CV they were reading, so the refusal is reported instead.
  const handoff = useMemo(() => resolveBuilderHandoff(resume, window.location.origin), [resume])

  const builderHandoffUrl = handoff.url ?? '/builder'

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

  const postBridgeEvent = useCallback((event: 'ready' | 'heightChange' | 'validationChange' | 'export' | 'sectionFocus' | 'error', payload: Record<string, unknown>) => {
    if (window.parent === window || !eventOrigin) {
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
      protocolVersion: PROTOCOL_VERSION,
      sdkVersion,
      mode,
      resumeId: resumeId ?? 'portable',
      showDownload,
      lockedTemplate: lockedTemplate ?? null,
      template: resume.meta.template,
      score: validation.score,
      qualityScore: validation.qualityScore,
      completenessScore: validation.completenessScore,
    })
  }, [lockedTemplate, mode, postBridgeEvent, resume, resumeId, sdkVersion, showDownload, syncNonce, validation])

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
        const height = Math.min(10000, Math.ceil(root.scrollHeight))
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
    const seen = new Set<string>()
    const visibleSections = new Map<Element, number>()
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleSections.set(entry.target, entry.intersectionRatio)
        else visibleSections.delete(entry.target)
      })

      const current = [...visibleSections.entries()].sort((left, right) => right[1] - left[1])[0]
      if (!current || current[1] < 0.1) return
      const label = (current[0] as HTMLElement).querySelector('h2')?.textContent?.trim() ?? 'section'
      if (seen.has(label)) return
      seen.add(label)
      postBridgeEvent('sectionFocus', { section: label })
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] })

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [postBridgeEvent, resume])

  // Inbound host commands. The frame is the untrusted side here: a page that
  // embeds it controls window.parent, so every message is checked against the
  // parent window, the configured parent origin, this embed's id, the protocol
  // version, and the per-command schema before anything happens.
  useEffect(() => {
    if (window.parent === window) return

    const parentOrigin = normalizeTargetOrigin(eventOrigin) ?? getParentOrigin()
    if (!parentOrigin) return

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      if (parentOrigin !== '*' && event.origin !== parentOrigin) return

      const command = parseHostCommand(event.data, embedId)
      if (!command) {
        // Only report messages that are recognisably ours, so the error event
        // cannot be used to amplify unrelated traffic from other frames.
        if (isUnsupportedProtocol(event.data)) {
          postBridgeEvent('error', {
            code: 'unsupported-protocol',
            message: `Host speaks protocol "${String((event.data as { version?: unknown }).version)}", this embed speaks "${PROTOCOL_VERSION}".`,
            fatal: true,
          })
        } else if (parseHostCommandName(event.data, embedId) === 'requestExport') {
          // A well-formed command from this host with arguments the schema
          // refuses. Silence here would leave the host waiting for an export
          // event that is never coming.
          postBridgeEvent('error', {
            code: 'command-failed',
            message: `requestExport was rejected: format must be one of ${EXPORT_FORMATS.join(', ')}.`,
            fatal: false,
          })
        }
        return
      }

      switch (command.command) {
        case 'syncState':
          // The ready and validationChange effects re-fire on their own when
          // their inputs change; bumping the key forces a re-emit for a host
          // that attached after the first handshake.
          setSyncNonce((value) => value + 1)
          return
        case 'setResume': {
          const incoming = command.payload.resume
          // normalizeResume fills every gap from defaults, so an arbitrary
          // object would quietly become a blank CV and wipe what is on screen.
          // A bridge replacement must at least look like a resume before it is
          // allowed to replace one.
          if (typeof incoming !== 'object' || incoming === null || !('basics' in incoming)) {
            postBridgeEvent('error', {
              code: 'resume-invalid',
              message: 'setResume was rejected: the payload does not look like a CV-Embed document.',
              fatal: false,
            })
            return
          }
          let next: Resume
          try {
            next = normalizeResume(incoming)
          } catch {
            postBridgeEvent('error', {
              code: 'resume-invalid',
              message: 'setResume was rejected: the document did not match the CV-Embed schema.',
              fatal: false,
            })
            return
          }
          setResume(lockedTemplate ? { ...next, meta: { ...next.meta, template: lockedTemplate } } : next)
          return
        }
        case 'focusSection': {
          const target = command.payload.section.trim().toLowerCase()
          const heading = [...document.querySelectorAll<HTMLElement>('.resume-template section h2')]
            .find((node) => (node.textContent ?? '').trim().toLowerCase() === target)
          if (!heading) {
            postBridgeEvent('error', {
              code: 'command-failed',
              message: `focusSection could not find "${command.payload.section}" in the rendered document.`,
              fatal: false,
            })
            return
          }
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          heading.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
          heading.setAttribute('tabindex', '-1')
          heading.focus({ preventScroll: true })
          return
        }
        case 'requestExport': {
          // The embed does not render a file. It reports the route a host can
          // send the viewer to, and echoes the requested format back so the
          // host can match this event to the request it sent, as opposed to the
          // reader taking the builder link on their own.
          if (handoff.tooLarge) {
            postBridgeEvent('error', {
              code: 'resume-too-large',
              message: 'requestExport was refused: this document is too large to hand off to the builder as a portable link.',
              fatal: false,
            })
            return
          }
          postBridgeEvent('export', {
            action: mode === 'edit' ? 'open-builder-edit' : 'open-builder',
            url: builderHandoffUrl,
            requestedFormat: command.payload.format,
          })
          return
        }
        case 'setOptions':
          setHostOptions({
            primaryColor: command.payload.primaryColor,
            density: command.payload.density,
            showDownload: command.payload.showDownload,
          })
          return
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [builderHandoffUrl, embedId, eventOrigin, handoff.tooLarge, lockedTemplate, mode, postBridgeEvent])

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
          <p>Bridge: postMessage active</p>
        </section>
      ) : null}
      <section className="panel">
        <TemplateRenderer resume={resume} primaryColor={primaryColor} density={density} />
        {showDownload ? (
          <a
            className="link-button"
            href={builderHandoffUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => postBridgeEvent('export', {
              action: mode === 'edit' ? 'open-builder-edit' : 'open-builder',
              url: builderHandoffUrl,
              // A reader-initiated handoff is not the answer to any request.
              requestedFormat: null,
            })}
          >
            {mode === 'edit' ? 'Open Editable Builder' : 'Open in Builder'}
          </a>
        ) : null}
      </section>
    </main>
  )
}
