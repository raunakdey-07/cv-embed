import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { assertPublicSurface } from '../scripts/assert-sdk-surface.ts'
import { PROTOCOL_VERSION, SDK_VERSION } from './protocol'

/**
 * Guards the shipped-artifact check itself.
 *
 * A build gate that cannot fail is not a gate. The committed bundle proves the
 * check does not fire on good output; the synthetic bundles prove it fires on
 * every way this build can silently break a host. They are written by hand
 * rather than mutated from `public/sdk.js` because the minifier renames locals
 * on every rebuild, so a test coupled to those names would fail for reasons
 * that have nothing to do with the check.
 */

const artifact = await readFile(new URL('../public/sdk.js', import.meta.url), 'utf8')

/** A minimal bundle that satisfies everything the check looks at. */
function bundle(overrides: { version?: string; protocolVersion?: string; render?: string; footer?: string } = {}) {
  const {
    version = SDK_VERSION,
    protocolVersion = PROTOCOL_VERSION,
    render = 'render: function render(config){ if(!config.resumeId && !config.resumeData){ throw new Error("resumeId or resumeData is required") } }',
    footer = 'CVEmbed=CVEmbed.CVEmbed;',
  } = overrides
  return `var CVEmbed=(function(exports){ var api={version:${JSON.stringify(version)},protocolVersion:${JSON.stringify(protocolVersion)},${render}}; exports.CVEmbed=api; return exports; })({});${footer}`
}

describe('shipped SDK artifact', () => {
  it('passes for the committed public/sdk.js', () => {
    expect(() => assertPublicSurface(artifact)).not.toThrow()
  })

  it('is the artifact the check would reject once a public member disappears', () => {
    // Guards the fixture above: if the real artifact stopped exposing render,
    // every synthetic case here would be passing for the wrong reason.
    expect(artifact).toContain('render:')
    expect(artifact).toContain('CVEmbed=CVEmbed.CVEmbed')
  })

  it('passes for a well-formed bundle', () => {
    expect(() => assertPublicSurface(bundle())).not.toThrow()
  })

  it('rejects a bundle whose render export was renamed', () => {
    const broken = bundle({ render: 'otherName: function otherName(config){}' })
    expect(() => assertPublicSurface(broken)).toThrow(/CVEmbed\.render/)
  })

  it('rejects a bundle reporting the wrong SDK version', () => {
    expect(() => assertPublicSurface(bundle({ version: '0.0.0' }))).toThrow(/SDK version/)
  })

  it('rejects a bundle reporting the wrong protocol version', () => {
    expect(() => assertPublicSurface(bundle({ protocolVersion: '99' }))).toThrow(/protocol/)
  })

  it('rejects a bundle that never unwrapped the module namespace', () => {
    // Without the footer, window.CVEmbed is still the rollup namespace object.
    // A host reading CVEmbed.render gets undefined and only finds out at runtime.
    const broken = bundle({ footer: '' })
    expect(() => assertPublicSurface(broken)).toThrow(/CVEmbed\.render/)
  })

  it('rejects a bundle that stopped validating render arguments', () => {
    // Silently rendering nothing is worse than throwing: a host that forgot to
    // pass a resume gets a blank frame and no explanation.
    const broken = bundle({ render: 'render: function render(config){}' })
    expect(() => assertPublicSurface(broken)).toThrow(/resumeId nor resumeData/)
  })

  it('rejects a bundle that defines no global at all', () => {
    expect(() => assertPublicSurface('var unrelated = 1;')).toThrow(/window\.CVEmbed/)
  })
})
