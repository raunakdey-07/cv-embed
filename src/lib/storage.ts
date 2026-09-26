import type { Resume } from '../types/resume'
import { normalizeResume } from './utils'

const DRAFT_KEY = 'cvembed:draft'
const ACTIVE_EMBED_KEY = 'cvembed:activeEmbedId'

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

export function loadDraft(): Resume | null {
  return parseResume(readRaw(window.localStorage, DRAFT_KEY))
    ?? parseResume(readRaw(window.sessionStorage, DRAFT_KEY))
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
