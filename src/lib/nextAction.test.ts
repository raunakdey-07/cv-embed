import { describe, expect, it } from 'vitest'
import { resolveNextActionSection } from './nextAction'

describe('resolveNextActionSection', () => {
  it('prefers essentials gap when present', () => {
    expect(resolveNextActionSection('education', 'projects')).toBe('education')
  })

  it('falls back to issue section when essentials are complete', () => {
    expect(resolveNextActionSection(null, 'projects')).toBe('projects')
  })

  it('returns null when both inputs are null', () => {
    expect(resolveNextActionSection(null, null)).toBeNull()
  })
})
