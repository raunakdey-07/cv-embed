import { describe, expect, it } from 'vitest'
import { assertPdfTextSupported, findUnsupportedPdfCharacters, PdfUnsupportedCharactersError, wrapForPdf } from './pdfText'

describe('PDF text support guard', () => {
  it('allows common Latin and resume punctuation', () => {
    expect(findUnsupportedPdfCharacters({ name: 'José — Zhang • 2024' })).toEqual([])
  })

  it('reports CJK and emoji characters without truncating the scan', () => {
    expect(findUnsupportedPdfCharacters({ name: '张伟 🚀', location: '上海' })).toEqual(['张', '伟', '🚀', '上', '海'])
  })

  it('throws a typed error for unsupported text', () => {
    expect(() => assertPdfTextSupported({ summary: '🚀' })).toThrow(PdfUnsupportedCharactersError)
  })
})

describe('PDF line wrapping for unbreakable runs', () => {
  const unwrapped = (value: string) => value.replace(/\s+/g, '')

  it('leaves ordinary resume text untouched', () => {
    const prose = 'Led the platform team, cutting month-end close from 9 hours to 40 minutes.'
    expect(wrapForPdf(prose)).toBe(prose)
    expect(wrapForPdf('https://example.com/short')).toBe('https://example.com/short')
  })

  it('breaks a long unbroken run so it cannot overflow the page', () => {
    const wrapped = wrapForPdf('X'.repeat(700))
    expect(wrapped.length).toBeGreaterThan(700)
    expect(unwrapped(wrapped)).toBe('X'.repeat(700))
  })

  it('preserves every character of a very long URL', () => {
    const url = `https://example.com/${'a'.repeat(1000)}`
    expect(unwrapped(wrapForPdf(url))).toBe(unwrapped(url))
  })

  it('prefers natural separators when breaking a URL', () => {
    const url = `https://example.com/${'segment/'.repeat(60)}`
    const lines = wrapForPdf(url).split('\n')
    // Greedy fill up to the limit, always cutting just after a separator.
    expect(lines[0].length).toBeLessThanOrEqual(48)
    expect(lines[0].endsWith('/')).toBe(true)
    expect(lines[0].startsWith('https://example.com/')).toBe(true)
    expect(lines.every((line) => line.length <= 48)).toBe(true)
    expect(unwrapped(lines.join(''))).toBe(unwrapped(url))
  })

  it('keeps whitespace between short words intact', () => {
    const value = `Go, Postgres, Kafka and ${'B'.repeat(300)}`
    const lines = wrapForPdf(value).split('\n')
    expect(lines[0].startsWith('Go, Postgres, Kafka and ')).toBe(true)
    expect(lines[0].length).toBeLessThanOrEqual(48)
    expect(unwrapped(lines.join(' '))).toBe(unwrapped(value))
  })

  it('leaves text that already fits within a line completely alone', () => {
    const value = 'a'.repeat(48)
    expect(wrapForPdf(value)).toBe(value)
  })
})
