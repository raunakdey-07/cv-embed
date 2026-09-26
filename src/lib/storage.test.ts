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
    expect(loadDraft()?.basics.name).toBe('Saved User')
  })

  it('prefers the current local draft over an older session draft', () => {
    const local = createEmptyResume()
    local.basics.name = 'Local User'
    const session = createEmptyResume()
    session.basics.name = 'Session User'
    window.localStorage.setItem('cvembed:draft', JSON.stringify(local))
    window.sessionStorage.setItem('cvembed:draft', JSON.stringify(session))

    expect(loadDraft()?.basics.name).toBe('Local User')
  })

  it('falls back to session storage when local storage is blocked', () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new FailingStorage() })
    const resume = createEmptyResume()
    resume.basics.name = 'Session User'

    expect(saveDraft(resume)).toBe(true)
    expect(loadDraft()?.basics.name).toBe('Session User')
  })

  it('drops unknown persisted fields while preserving known data', () => {
    window.localStorage.setItem('cvembed:draft', JSON.stringify({
      ...createEmptyResume(),
      unknownField: 'ignored',
    }))

    expect(loadDraft()?.basics.name).toBe('')
    expect(loadDraft()).not.toHaveProperty('unknownField')
  })

  it('reports failure when both storage scopes are blocked', () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new FailingStorage() })
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: new FailingStorage() })

    expect(saveDraft(createEmptyResume())).toBe(false)
  })

  it('ignores malformed stored data', () => {
    window.localStorage.setItem('cvembed:draft', '{"education":{}}')
    expect(loadDraft()).toBeNull()
  })
})
