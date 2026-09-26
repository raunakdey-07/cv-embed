import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const checkOnly = process.argv.includes('--check')

const result = await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    lib: {
      entry: fileURLToPath(new URL('../sdk/index.ts', import.meta.url)),
      name: 'CVEmbed',
      formats: ['iife'],
      fileName: () => 'sdk.js',
    },
    minify: false,
    sourcemap: false,
    target: 'es2018',
    write: false,
    rollupOptions: {
      output: {
        footer: 'CVEmbed = CVEmbed.CVEmbed;',
      },
    },
  },
})

const output = Array.isArray(result) ? result[0] : result
const chunk = output.output.find((entry) => entry.type === 'chunk')
if (!chunk) {
  throw new Error('SDK build produced no JavaScript chunk')
}

const targetPath = fileURLToPath(new URL('../public/sdk.js', import.meta.url))
const current = await readFile(targetPath, 'utf8').catch(() => '')

if (checkOnly) {
  if (current !== chunk.code) {
    throw new Error('public/sdk.js is stale. Run npm run build:sdk and commit the result.')
  }
  console.log('public/sdk.js matches the TypeScript SDK source')
} else {
  await writeFile(targetPath, chunk.code)
  console.log('Wrote public/sdk.js from sdk/index.ts')
}
