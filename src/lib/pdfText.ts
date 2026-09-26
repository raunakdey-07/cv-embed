const PDF_SAFE_PUNCTUATION = new Set([
  '\u2013', '\u2014', '\u2018', '\u2019', '\u201c', '\u201d',
  '\u2022', '\u2026', '\u2122', '\u20ac', '\u00a0',
])

export class PdfUnsupportedCharactersError extends Error {
  readonly characters: string[]

  constructor(characters: string[]) {
    super('PDF export contains characters the built-in PDF fonts cannot render')
    this.name = 'PdfUnsupportedCharactersError'
    this.characters = characters
  }
}

function collectText(value: unknown, output: string[]): void {
  if (typeof value === 'string') {
    output.push(value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectText(entry, output))
    return
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectText(entry, output))
  }
}

export function findUnsupportedPdfCharacters(value: unknown): string[] {
  const text: string[] = []
  collectText(value, text)
  const unsupported = new Set<string>()

  for (const chunk of text) {
    for (const character of chunk) {
      const codePoint = character.codePointAt(0) ?? 0
      if (codePoint > 255 && !PDF_SAFE_PUNCTUATION.has(character)) {
        unsupported.add(character)
      }
    }
  }

  return [...unsupported].slice(0, 12)
}

export function assertPdfTextSupported(value: unknown): void {
  const characters = findUnsupportedPdfCharacters(value)
  if (characters.length > 0) {
    throw new PdfUnsupportedCharactersError(characters)
  }
}
