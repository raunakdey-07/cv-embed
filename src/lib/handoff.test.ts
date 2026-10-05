import { describe, expect, it } from 'vitest'
import { resolveBuilderHandoff } from './handoff'
import { MAX_PORTABLE_PAYLOAD_CHARS } from './utils'
import type { Resume } from '../types/resume'

const origin = 'https://example.test'

function resumeWith(overrides: Partial<Resume> = {}): Resume {
  return {
    meta: {
      version: '1.0',
      template: 'minimal',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      documentOptions: {},
    },
    basics: {
      name: 'Handoff User',
      headline: 'Engineer',
      email: 'handoff@example.com',
      phone: '',
      location: '',
      summary: 'Builds reliable tools.',
      links: [],
    },
    education: [],
    experience: [],
    projects: [],
    skills: { languages: [], frameworks: [], tools: [], other: [] },
    certifications: [],
    accomplishments: [],
    activities: [],
    volunteering: [],
    publications: [],
    ...overrides,
  } as Resume
}

describe('resolveBuilderHandoff', () => {
  it('carries the document in the handoff URL fragment', () => {
    const handoff = resolveBuilderHandoff(resumeWith(), origin)
    expect(handoff.tooLarge).toBe(false)
    expect(handoff.url).toContain('/builder')
    // The fragment is what makes the handoff useful: the visitor arrives in the
    // builder with their CV already loaded rather than an empty editor.
    expect(handoff.url).toContain('#data=')
  })

  it('reports an oversized document instead of returning a route that drops it', () => {
    // The bug this guards: a bare /builder URL looks like a working route, but
    // it opens an empty editor and the visitor loses the CV they were reading.
    const oversized = resumeWith({
      basics: {
        ...resumeWith().basics,
        summary: 'x'.repeat(MAX_PORTABLE_PAYLOAD_CHARS + 1),
      },
    })

    const handoff = resolveBuilderHandoff(oversized, origin)
    expect(handoff.tooLarge).toBe(true)
    expect(handoff.url).toBeNull()
  })

  it('still hands off a document just under the limit', () => {
    // Guards the boundary: the refusal has to be a real limit, not a low one.
    const summary = 'x'.repeat(MAX_PORTABLE_PAYLOAD_CHARS - 5_000)
    const handoff = resolveBuilderHandoff(resumeWith({
      basics: { ...resumeWith().basics, summary },
    }), origin)

    expect(handoff.tooLarge).toBe(false)
    expect(handoff.url).toContain('#data=')
  })

  it('falls back to the builder when there is no document to hand off', () => {
    const handoff = resolveBuilderHandoff(null, origin)
    expect(handoff.url).toBe('/builder')
    expect(handoff.tooLarge).toBe(false)
  })
})
