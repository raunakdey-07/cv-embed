import { readFile } from 'node:fs/promises'

const distUrl = new URL('../dist/', import.meta.url)
const html = await readFile(new URL('index.html', distUrl), 'utf8')
const entryMatch = html.match(/src="([^"]+\.js)"/)

if (!entryMatch) {
  throw new Error('Could not find the production entry script')
}

const entry = await readFile(new URL(entryMatch[1].replace(/^\//, ''), distUrl), 'utf8')

if (html.includes('pdfRenderer') || /from ["'][^"']*pdfRenderer/.test(entry)) {
  throw new Error('Production entry imports the PDF renderer eagerly')
}

console.log('Production entry keeps the PDF renderer on demand')
