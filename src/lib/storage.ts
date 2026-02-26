import type { Resume } from '../types/resume'
import { normalizeResume } from './utils'

const DRAFT_KEY = 'cvembed:draft'
const ACTIVE_EMBED_KEY = 'cvembed:activeEmbedId'

export function saveDraft(resume: Resume): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(resume))
}

export function loadDraft(): Resume | null {
  const raw = sessionStorage.getItem(DRAFT_KEY)
  if (!raw) {
    return null
  }

  try {
    return normalizeResume(JSON.parse(raw) as Resume)
  } catch {
    return null
  }
}

export function saveEmbedResume(resumeId: string, resume: Resume): void {
  localStorage.setItem(`cvembed:resume:${resumeId}`, JSON.stringify(resume))
  localStorage.setItem(ACTIVE_EMBED_KEY, resumeId)
}

export function loadEmbedResume(resumeId: string): Resume | null {
  const raw = localStorage.getItem(`cvembed:resume:${resumeId}`)
  if (!raw) {
    return null
  }

  try {
    return normalizeResume(JSON.parse(raw) as Resume)
  } catch {
    return null
  }
}

export function loadActiveEmbedId(): string | null {
  return localStorage.getItem(ACTIVE_EMBED_KEY)
}
