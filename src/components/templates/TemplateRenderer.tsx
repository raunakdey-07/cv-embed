import type { Resume } from '../../types/resume'
import { CompactTemplate } from './Compact'
import { MinimalTemplate } from './Minimal'

interface TemplateRendererProps {
  resume: Resume
  primaryColor?: string
  density?: 'normal' | 'compact'
}

export function TemplateRenderer({ resume, primaryColor, density = 'normal' }: TemplateRendererProps) {
  const densityMode = density === 'compact' ? 'compact' : resume.meta.documentOptions.density

  if (resume.meta.template === 'compact') {
    return <CompactTemplate resume={resume} primaryColor={primaryColor} densityMode={densityMode} />
  }

  return <MinimalTemplate resume={resume} primaryColor={primaryColor} densityMode={densityMode} />
}
