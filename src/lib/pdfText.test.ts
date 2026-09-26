import { describe, expect, it } from 'vitest'
import { assertPdfTextSupported, findUnsupportedPdfCharacters, PdfUnsupportedCharactersError } from './pdfText'

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
