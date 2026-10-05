import { createContext, runInContext } from 'node:vm'
import { PROTOCOL_VERSION, SDK_VERSION } from '../sdk/protocol.ts'

/**
 * Verifies that a built SDK bundle exposes the documented global.
 *
 * The global is the whole public contract, so a rename or a dropped export is a
 * breaking change for every host page. This runs the real bundle bytes in a
 * throwaway host environment and inspects the result, rather than
 * pattern-matching the source text.
 *
 * Text matching is not good enough here, and not only because minification
 * renames every local: a regex can only prove the build produced the string it
 * looked for. It cannot tell a working bundle from one that kept the string
 * but broke the behaviour behind it, and the previous version of this check had
 * exactly that blind spot. It also failed on a correct minified bundle, because
 * `render: (config) =>` is not the text `render:e=>`.
 *
 * Evaluating the artifact subsumes the namespace-unwrap check too: if the
 * footer that replaces the module namespace with the documented object is
 * missing, `CVEmbed` is still the namespace object, which has no `render`, and
 * the failure surfaces below.
 */
export function assertPublicSurface(code) {
  // A minimal host: enough for the bundle to evaluate, not enough to render.
  // render() is only called for its argument validation.
  const sandbox = {
    window: {
      location: { origin: 'https://example.test', href: 'https://example.test/' },
      addEventListener() {},
      removeEventListener() {},
    },
    document: { currentScript: null, querySelector: () => null },
    URL,
    TextEncoder,
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  }
  sandbox.globalThis = sandbox

  const context = createContext(sandbox)
  runInContext(code, context, { timeout: 5_000 })

  const api = context.CVEmbed
  if (!api || typeof api !== 'object') {
    throw new Error('public/sdk.js does not define a window.CVEmbed object.')
  }
  if (typeof api.render !== 'function') {
    throw new Error('public/sdk.js no longer exposes CVEmbed.render. Hosts depend on it.')
  }
  if (api.version !== SDK_VERSION) {
    throw new Error(`public/sdk.js reports SDK version ${JSON.stringify(api.version)}, expected ${SDK_VERSION}.`)
  }
  if (api.protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(`public/sdk.js reports protocol ${JSON.stringify(api.protocolVersion)}, expected ${PROTOCOL_VERSION}.`)
  }

  // The documented argument errors are part of the contract too: a host that
  // omits a resume must get a thrown Error, not a silent no-op.
  let threw = false
  try {
    api.render({ target: '#missing' })
  } catch {
    threw = true
  }
  if (!threw) {
    throw new Error('CVEmbed.render no longer rejects a config with neither resumeId nor resumeData.')
  }
}
