import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { PROTOCOL_VERSION, SDK_VERSION } from '../sdk/protocol.ts'
import { assertPublicSurface } from './assert-sdk-surface.ts'

const checkOnly = process.argv.includes('--check')

/**
 * Minified, because every host page downloads this file and the shipped bundle
 * is 53% smaller over the wire than readable output (158.8 kB -> 75.3 kB raw,
 * 28.4 kB -> 21.1 kB gzip, measured). No source map: a map would add 408 kB to
 * the repository to serve a debugging aid for a four-member public surface, and
 * the SDK types and protocol doc are the debugging path. Errors reach hosts
 * through `onError` with codes rather than as throws from minified frames.
 *
 * `keepNames` preserves function names in stack traces, which is what keeps a
 * minified SDK debuggable at all.
 */
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
    minify: 'esbuild',
    // Without this the minifier renames every internal function, so a stack
    // trace from inside the SDK reads `a` instead of `buildEmbedUrl`.
    esbuild: { keepNames: true },
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
  assertPublicSurface(current)
  console.log(`public/sdk.js matches the TypeScript SDK source (SDK ${SDK_VERSION}, protocol ${PROTOCOL_VERSION})`)
} else {
  assertPublicSurface(chunk.code)
  await writeFile(targetPath, chunk.code)
  console.log(`Wrote public/sdk.js from sdk/index.ts (SDK ${SDK_VERSION}, protocol ${PROTOCOL_VERSION})`)
}
