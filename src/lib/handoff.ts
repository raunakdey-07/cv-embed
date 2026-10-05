import { createBuilderHandoffUrl, encodeResumeForUrl, ResumeDataError } from './utils'
import type { Resume } from '../types/resume'

/**
 * Where the embed sends a viewer who wants to edit or export.
 *
 * The handoff carries the whole document in a URL fragment, so a document too
 * large for a portable link has no handoff at all. Reporting that is the point:
 * the previous behaviour returned a bare `/builder`, which looked like a working
 * route and silently dropped the CV the visitor was reading.
 */
export interface BuilderHandoff {
  /** Null when the document does not fit a portable link. */
  url: string | null
  /** True when the document is too large to hand off. */
  tooLarge: boolean
}

const FALLBACK_HANDOFF_URL = '/builder'

export function resolveBuilderHandoff(resume: Resume | null, origin: string): BuilderHandoff {
  if (!resume) return { url: FALLBACK_HANDOFF_URL, tooLarge: false }
  try {
    return { url: createBuilderHandoffUrl(origin, encodeResumeForUrl(resume)), tooLarge: false }
  } catch (error) {
    // encodeResumeForUrl throws for exactly one reason: the payload is larger
    // than MAX_PORTABLE_PAYLOAD_CHARS. Anything else is a bug worth surfacing
    // rather than dressing up as an oversized document.
    if (!(error instanceof ResumeDataError)) throw error
    return { url: null, tooLarge: true }
  }
}
