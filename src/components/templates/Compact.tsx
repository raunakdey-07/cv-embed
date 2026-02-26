import type { Resume } from '../../types/resume'
import { MinimalTemplate } from './Minimal'

interface CompactTemplateProps {
  resume: Resume
  primaryColor?: string
  densityMode?: 'comfortable' | 'compact' | 'relaxed'
}

export function CompactTemplate({ resume, primaryColor, densityMode = 'compact' }: CompactTemplateProps) {
  return <MinimalTemplate resume={resume} primaryColor={primaryColor} densityMode={densityMode} />
}
