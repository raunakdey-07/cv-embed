import { renderEmbed, type CVEmbedConfig } from './renderer'

export const CVEmbed = {
  render: (config: CVEmbedConfig) => renderEmbed(config),
}

export type { CVEmbedConfig }
