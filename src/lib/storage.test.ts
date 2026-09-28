import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyResume } from '../types/resume'
import { loadDraft, saveDraft } from './storage'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  [name: string]: unknown
}

class FailingStorage extends MemoryStorage {
  override setItem(): void {
    throw new DOMException('Storage unavailable', 'SecurityError')
  }
}

describe('draft storage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: new MemoryStorage(),
        sessionStorage: new MemoryStorage(),
      },
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
    vi.restoreAllMocks()
  })

  it('persists to local storage and reads the normalized resume', () => {
    const resume = createEmptyResume()
    resume.basics.name = 'Saved User'

    expect(saveDraft(resume)).toBe(true)
    expect(window.localStorage.getItem('cvembed:draft')).toContain('Saved User')
    expect(loadDraft().resume?.basics.name).toBe('Saved User')
    expect(loadDraft().status).toBe('ok')
  })

  it('prefers the current local draft over an older session draft', () => {
    const local = createEmptyResume()
    local.basics.name = 'Local User'
    const session = createEmptyResume()
    session.basics.name = 'Session User'
    window.localStorage.setItem('cvembed:draft', JSON.stringify(local))
    window.sessionStorage.setItem('cvembed:draft', JSON.stringify(session))

    expect(loadDraft().resume?.basics.name).toBe('Local User')
  })

  it('falls back to session storage when local storage is blocked', () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new FailingStorage() })
    const resume = createEmptyResume()
    resume.basics.name = 'Session User'

    expect(saveDraft(resume)).toBe(true)
    expect(loadDraft().resume?.basics.name).toBe('Session User')
  })

  it('drops unknown persisted fields while preserving known data', () => {
    window.localStorage.setItem('cvembed:draft', JSON.stringify({
      ...createEmptyResume(),
      unknownField: 'ignored',
    }))

    const result = loadDraft()
    expect(result.resume?.basics.name).toBe('')
    expect(result.resume).not.toHaveProperty('unknownField')
    expect(result.status).toBe('ok')
  })

  it('reports failure when both storage scopes are blocked', () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new FailingStorage() })
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: new FailingStorage() })

    expect(saveDraft(createEmptyResume())).toBe(false)
  })

  it('reports a missing draft rather than treating it as corrupt', () => {
    expect(loadDraft()).toEqual({ resume: null, status: 'missing', preserved: false })
  })

  it('quarantines an unreadable draft instead of leaving it to be overwritten', () => {
    window.localStorage.setItem('cvembed:draft', '{"education":{}}')

    const result = loadDraft()
    expect(result.resume).toBeNull()
    expect(result.status).toBe('unreadable')
    expect(result.preserved).toBe(true)
    // The original bytes survive under the quarantine key.
    expect(window.localStorage.getItem('cvembed:draft:unreadable')).toBe('{"education":{}}')
  })

  it('preserves the first unreadable draft and does not overwrite it with later ones', () => {
    window.localStorage.setItem('cvembed:draft', 'first broken payload')
    loadDraft()
    window.localStorage.setItem('cvembed:draft', 'second broken payload')
    loadDraft()

    expect(window.localStorage.getItem('cvembed:draft:unreadable')).toBe('first broken payload')
  })

  it('treats a draft written by a different schema version as unreadable', () => {
    const future = { ...createEmptyResume(), meta: { ...createEmptyResume().meta, version: '99.0' } }
    window.localStorage.setItem('cvembed:draft', JSON.stringify(future))

    expect(loadDraft().status).toBe('unreadable')
    expect(window.localStorage.getItem('cvembed:draft:unreadable')).toContain('99.0')
  })

  it('still reads a valid legacy draft that normalizes cleanly', () => {
    const legacy = { ...createEmptyResume(), legacyOnlyField: 'x' }
    window.localStorage.setItem('cvembed:draft', JSON.stringify(legacy))

    expect(loadDraft().status).toBe('ok')
  })
})
