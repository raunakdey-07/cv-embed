import { IconSliders } from '../ui/Icons'
import { DEFAULT_SECTION_ORDER, type DocumentOptions } from '../../types/resume'

interface DocumentOptionsSectionProps {
  options: DocumentOptions
  onChange: (next: DocumentOptions) => void
}

export function DocumentOptionsSection({ options, onChange }: DocumentOptionsSectionProps) {
  const update = <K extends keyof DocumentOptions>(key: K, value: DocumentOptions[K]) => {
    onChange({ ...options, [key]: value })
  }

  const labels: Record<keyof DocumentOptions['showSections'], string> = {
    summary: 'Summary',
    education: 'Education',
    experience: 'Experience',
    projects: 'Projects',
    skills: 'Skills',
    certifications: 'Certifications',
    accomplishments: 'Accomplishments',
    activities: 'Activities',
    volunteering: 'Volunteering',
    publications: 'Publications',
  }

  const toggleSection = (sectionId: keyof DocumentOptions['showSections']) => {
    onChange({
      ...options,
      showSections: {
        ...options.showSections,
        [sectionId]: !options.showSections[sectionId],
      },
    })
  }

  const moveSection = (sectionId: keyof DocumentOptions['showSections'], direction: -1 | 1) => {
    const currentIndex = options.sectionOrder.indexOf(sectionId)
    const targetIndex = currentIndex + direction
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= options.sectionOrder.length) {
      return
    }

    const next = [...options.sectionOrder]
    const [picked] = next.splice(currentIndex, 1)
    next.splice(targetIndex, 0, picked)
    update('sectionOrder', next)
  }

  const orderedSections = options.sectionOrder.length > 0 ? options.sectionOrder : DEFAULT_SECTION_ORDER

  return (
    <section className="panel">
      <div className="section-head">
        <IconSliders size={16} />
        <span className="section-title">Formatting</span>
      </div>
      <div className="field-grid">
        <label>Accent Color <input type="color" value={options.accentColor} onChange={(e) => update('accentColor', e.target.value)} /></label>
        <label>Font
          <select value={options.fontFamily} onChange={(e) => update('fontFamily', e.target.value as DocumentOptions['fontFamily'])}>
            <option value="satoshi">Bricolage Grotesque</option>
            <option value="clash">Syne</option>
            <option value="spacegrotesk">Azeret Mono</option>
            <option value="instrumentserif">Instrument Serif</option>
            <option value="helvetica">Helvetica</option>
            <option value="times">Times</option>
          </select>
        </label>
        <label>Size
          <select value={options.fontSize} onChange={(e) => update('fontSize', e.target.value as DocumentOptions['fontSize'])}>
            <option value="small">Small</option>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label>Line Height
          <select value={options.lineHeight} onChange={(e) => update('lineHeight', e.target.value as DocumentOptions['lineHeight'])}>
            <option value="tight">Tight</option>
            <option value="normal">Normal</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </label>
        <label>Headings
          <select value={options.sectionHeadingStyle} onChange={(e) => update('sectionHeadingStyle', e.target.value as DocumentOptions['sectionHeadingStyle'])}>
            <option value="rule">Uppercase + Rule</option>
            <option value="bold">Bold Titles</option>
            <option value="minimal">Minimal</option>
          </select>
        </label>
        <label>Bullets
          <select value={options.bulletStyle} onChange={(e) => update('bulletStyle', e.target.value as DocumentOptions['bulletStyle'])}>
            <option value="dot">Dot</option>
            <option value="dash">Dash</option>
          </select>
        </label>
        <label>Dates
          <select value={options.dateStyle} onChange={(e) => update('dateStyle', e.target.value as DocumentOptions['dateStyle'])}>
            <option value="range">Jun 2024 - Aug 2025</option>
            <option value="compact">Jun 2024–Aug 2025</option>
          </select>
        </label>
        <label>Density
          <select value={options.density} onChange={(e) => update('density', e.target.value as DocumentOptions['density'])}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </label>
      </div>

      <div className="section-head sub">
        <span className="section-title">Visibility & Order</span>
      </div>
      <div className="order-list">
        {orderedSections.map((sectionId, index) => (
          <div className="order-item" key={sectionId}>
            <label className="order-toggle">
              <input type="checkbox" checked={options.showSections[sectionId]} onChange={() => toggleSection(sectionId)} />
              <span>{labels[sectionId]}</span>
            </label>
            <div className="order-actions">
              <button type="button" className="order-btn" onClick={() => moveSection(sectionId, -1)} disabled={index === 0} title="Move up">↑</button>
              <button type="button" className="order-btn" onClick={() => moveSection(sectionId, 1)} disabled={index === orderedSections.length - 1} title="Move down">↓</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
