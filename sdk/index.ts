import { renderEmbed, type CVEmbedConfig } from './renderer'
import { PROTOCOL_VERSION, SDK_VERSION } from './protocol'

export const CVEmbed = {
  /** SDK package version. Bumped on any SDK release, independent of the wire protocol. */
  version: SDK_VERSION,
  /** Wire protocol version this SDK speaks. */
  protocolVersion: PROTOCOL_VERSION,
  render: (config: CVEmbedConfig) => renderEmbed(config),
}

export type {
  CVEmbedBridgeEvent,
  CVEmbedConfig,
  CVEmbedErrorPayload,
  CVEmbedEvents,
  CVEmbedHostCommand,
  CVEmbedHostCommandPayloads,
  CVEmbedInstance,
  CVEmbedOptions,
  CVEmbedTheme,
} from './renderer'
export type { EmbedEventName, HostCommandName } from './protocol'
