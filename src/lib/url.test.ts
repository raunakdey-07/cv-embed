import { describe, expect, it } from 'vitest'
import { getSafeExternalUrl, isSafeExternalUrl } from './url'

describe('resume URL safety', () => {
  it.each([
    'https://example.com/path',
    'http://example.com',
    '  https://example.com/path  ',
  ])('allows web URLs: %s', (value) => {
    expect(isSafeExternalUrl(value)).toBe(true)
    expect(getSafeExternalUrl(value)).toBe(value.trim())
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///etc/passwd',
    'mailto:test@example.com',
    'www.example.com',
    'not a url',
  ])('rejects non-web URL: %s', (value) => {
    expect(getSafeExternalUrl(value)).toBe('')
  })
})
