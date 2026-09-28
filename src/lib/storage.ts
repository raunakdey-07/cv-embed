import type { Resume } from '../types/resume'
import { normalizeResume } from './utils'

const DRAFT_KEY = 'cvembed:draft'
const ACTIVE_EMBED_KEY = 'cvembed:activeEmbedId'
const QUARANTINE_KEY = 'cvembed:draft:unreadable'

export type DraftLoadStatus = 'ok' | 'missing' | 'unreadable'

export interface DraftLoadResult {
  resume: Resume | null
  status: DraftLoadStatus
  /** Raw bytes of a draft that could not be parsed, kept for recovery. */
  preserved: boolean
}

function readRaw(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeRaw(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // Nothing else to do; the caller already has a usable fallback.
  }
}

function parseResume(raw: string | null): Resume | null {
  if (!raw) return null
  try {
    return normalizeResume(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function saveDraft(resume: Resume): boolean {
  const serialized = JSON.stringify(resume)
  if (writeRaw(window.localStorage, DRAFT_KEY, serialized)) return true
  return writeRaw(window.sessionStorage, DRAFT_KEY, serialized)
}

/**
 * Reads the saved draft. A draft that exists but cannot be parsed is never
 * silently replaced: the raw bytes are moved to a quarantine key first, so the
 * autosave that follows cannot destroy a CV the user could still recover.
 */
export function loadDraft(): DraftLoadResult {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const raw = readRaw(storage, DRAFT_KEY)
    if (raw === null) continue

    const resume = parseResume(raw)
    if (resume) return { resume, status: 'ok', preserved: false }

    const alreadyPreserved = readRaw(window.localStorage, QUARANTINE_KEY) !== null
    if (!alreadyPreserved) {
      writeRaw(window.localStorage, QUARANTINE_KEY, raw)
    }
    removeRaw(storage, DRAFT_KEY)
    return { resume: null, status: 'unreadable', preserved: true }
  }

  return { resume: null, status: 'missing', preserved: false }
}

export function saveEmbedResume(resumeId: string, resume: Resume): boolean {
  const serialized = JSON.stringify(resume)
  if (!writeRaw(window.localStorage, `cvembed:resume:${resumeId}`, serialized)) return false
  writeRaw(window.localStorage, ACTIVE_EMBED_KEY, resumeId)
  return true
}

export function loadEmbedResume(resumeId: string): Resume | null {
  return parseResume(readRaw(window.localStorage, `cvembed:resume:${resumeId}`))
}

export function loadActiveEmbedId(): string | null {
  return readRaw(window.localStorage, ACTIVE_EMBED_KEY)
}

export function loadPublicBaseUrl(): string {
  return readRaw(window.localStorage, 'cv-embed:public-base-url') ?? ''
}

export function savePublicBaseUrl(value: string): boolean {
  return writeRaw(window.localStorage, 'cv-embed:public-base-url', value)
}
