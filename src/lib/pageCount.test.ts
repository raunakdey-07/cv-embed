import { describe, expect, it } from 'vitest'
import { createEmptyResume } from '../types/resume'
import { isPageCountMeasured, resolvePageCountIndicator, UNMEASURED_PAGE_COUNT } from './pageCount'

/**
 * Mirrors the builder's measurement lifecycle. `lastMeasuredResume` is identity
 * based, exactly as in BuilderPage: a measurement only describes the exact
 * resume object that was measured, so editing the resume invalidates it. The
 * cached count survives so a re-scheduled measurement of the same resume can
 * render instantly, but pageCount reports the effective value the UI uses.
 */
function createPageCountModel() {
  let cachedCount = UNMEASURED_PAGE_COUNT
  let measuredResume: object | null = null

  return {
    get pageCount() {
      return measuredResume === null ? UNMEASURED_PAGE_COUNT : cachedCount
    },
    get indicator() {
      return resolvePageCountIndicator(this.pageCount, { isEstimating: false, isStale: false })
    },
    settleBlank(resume: object) {
      measuredResume = resume
      cachedCount = UNMEASURED_PAGE_COUNT
    },
    measure(resume: object, count: number) {
      measuredResume = resume
      cachedCount = count
    },
    /** Every resume edit produces a new object, as setResume does. */
    edit(): object {
      const edited = { ...createEmptyResume() }
      measuredResume = null
      return edited
    },
  }
}

describe('unmeasured page count', () => {
  it('defaults to 0, not 1', () => {
    expect(UNMEASURED_PAGE_COUNT).toBe(0)
  })

  it('a newly created resume has no measured page count', () => {
    // createEmptyResume carries no page count field at all: the count is
    // transient measurement state, never resume data, so it cannot be
    // persisted, imported, or defaulted into an old draft.
    expect(Object.keys(createEmptyResume())).not.toContain('pageCount')
    expect(Object.keys(createEmptyResume().meta)).not.toContain('pageCount')
  })

  it('is not reported as measured', () => {
    expect(isPageCountMeasured(UNMEASURED_PAGE_COUNT)).toBe(false)
    expect(isPageCountMeasured(0)).toBe(false)
  })
})

describe('page count indicator', () => {
  it('renders nothing at all when unmeasured', () => {
    expect(resolvePageCountIndicator(0)).toBeNull()
    expect(resolvePageCountIndicator(0, { isEstimating: true, isStale: true })).toBeNull()
  })

  it('never produces a placeholder or a zero-page label', () => {
    const indicator = resolvePageCountIndicator(0)
    expect(indicator).toBeNull()
    for (const text of ['PDF pages: 0', '0 pages', 'Not checked', 'Checking...', '—']) {
      expect(text).not.toBe(indicator?.text ?? '')
    }
  })

  it('shows a measured one-page count', () => {
    expect(resolvePageCountIndicator(1)?.text).toBe('PDF pages: 1')
  })

  it('shows the actual measured multi-page count', () => {
    expect(resolvePageCountIndicator(2)?.text).toBe('PDF pages: 2')
    expect(resolvePageCountIndicator(7)?.text).toBe('PDF pages: 7')
  })

  it('treats an in-flight recalculation as an estimate', () => {
    expect(resolvePageCountIndicator(2, { isEstimating: true, isStale: true })?.text).toBe('Est. PDF pages: 2')
    expect(resolvePageCountIndicator(2, { isEstimating: true, isStale: false })?.text).toBe('PDF pages: 2')
  })

  it('rejects a non-finite count instead of rendering NaN', () => {
    expect(resolvePageCountIndicator(Number.NaN)).toBeNull()
    expect(resolvePageCountIndicator(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('always carries a non-empty accessible title when shown', () => {
    expect(resolvePageCountIndicator(1)?.title.length).toBeGreaterThan(0)
  })
})

describe('page count lifecycle', () => {
  it('shows nothing before any measurement', () => {
    const model = createPageCountModel()
    expect(model.pageCount).toBe(0)
    expect(model.indicator).toBeNull()
  })

  it('shows nothing for a settled empty resume', () => {
    const model = createPageCountModel()
    model.settleBlank(createEmptyResume())
    expect(model.pageCount).toBe(0)
    expect(model.indicator).toBeNull()
  })

  it('shows the measured count after a real measurement', () => {
    const model = createPageCountModel()
    const resume = createEmptyResume()
    model.measure(resume, 1)
    expect(model.indicator?.text).toBe('PDF pages: 1')
  })

  it('invalidates back to unmeasured when the resume is edited', () => {
    const model = createPageCountModel()
    model.measure(createEmptyResume(), 2)
    expect(model.indicator?.text).toBe('PDF pages: 2')

    model.edit()
    expect(model.pageCount).toBe(0)
    expect(model.indicator).toBeNull()
  })

  it('shows the new count only after the edited resume is measured again', () => {
    const model = createPageCountModel()
    model.measure(createEmptyResume(), 2)
    const edited = model.edit()
    model.measure(edited, 3)
    expect(model.indicator?.text).toBe('PDF pages: 3')
  })
})
