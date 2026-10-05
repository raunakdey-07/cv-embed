import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { PROTOCOL_VERSION, SDK_VERSION } from '../sdk/protocol.ts'

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

/**
 * The global is the whole public contract, so a rename or a dropped export is a
 * breaking change for every host page. Checking it here means the build fails
 * rather than the first integrator finding out.
 */
function assertPublicSurface(code) {
  const required = [
    ['version', /version:\s*SDK_VERSION/],
    ['protocolVersion', /protocolVersion:\s*PROTOCOL_VERSION/],
    ['render', /render:\s*\(config2?\)\s*=>/],
  ]
  for (const [name, pattern] of required) {
    if (!pattern.test(code)) {
      throw new Error(`public/sdk.js no longer exposes CVEmbed.${name}. Hosts depend on it.`)
    }
  }
  if (!code.includes(`CVEmbed = CVEmbed.CVEmbed;`)) {
    throw new Error('public/sdk.js does not unwrap the bundle namespace, so window.CVEmbed is not the documented object.')
  }
  if (!code.includes(`protocolVersion: PROTOCOL_VERSION`) && !code.includes('protocolVersion')) {
    throw new Error('public/sdk.js is missing protocolVersion.')
  }
}

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
