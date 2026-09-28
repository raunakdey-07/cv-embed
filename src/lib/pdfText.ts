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

// react-pdf lays out with a word-based line breaker. A run with no break
// opportunity (a long URL, a slug, a pasted token) is measured as one line: if
// it is wider than the page it is either dropped outright or drawn past the
// right edge and clipped, so the exported document silently disagrees with the
// editor. Every character still has to reach the artifact, so the fix is to
// give react-pdf explicit line breaks rather than truncate or clip.
const MAX_UNBREAKABLE_RUN = 48

// Prefer natural separators so a wrapped URL or path stays readable.
const BREAK_AFTER = /[/\\.\-_?=&#~:@%+;,]/

function breakIndex(run: string, room: number): number {
  for (let index = room - 1; index > 0; index -= 1) {
    if (BREAK_AFTER.test(run[index - 1])) return index
  }
  return room
}

function wrapLine(line: string): string {
  // Split on the capturing separator so runs of whitespace survive intact.
  const tokens = line.split(/(\s+)/).filter((token) => token.length > 0)
  const lines: string[] = []
  let current = ''

  const flush = () => {
    if (current.length > 0) {
      lines.push(current)
      current = ''
    }
  }

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      current += token
      continue
    }
    if (token.length <= MAX_UNBREAKABLE_RUN) {
      current += token
      continue
    }
    let rest = token
    while (rest.length > 0) {
      const room = MAX_UNBREAKABLE_RUN - current.length
      if (room <= 0) {
        flush()
        continue
      }
      if (rest.length <= room) {
        current += rest
        rest = ''
        break
      }
      const cut = breakIndex(rest, room)
      current += rest.slice(0, cut)
      rest = rest.slice(cut)
      flush()
    }
  }
  flush()

  return lines.join('\n')
}

/**
 * Wraps runs that are too long to fit on one PDF line, preserving every
 * character. Normal words, punctuation, and existing whitespace are untouched,
 * so this is a no-op for every realistic resume value.
 */
export function wrapForPdf(value: string): string {
  return value.split('\n').map(wrapLine).join('\n')
}
