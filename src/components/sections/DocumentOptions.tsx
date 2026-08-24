import type { DocumentOptions } from '../../types/resume'

interface DocumentOptionsSectionProps {
  options: DocumentOptions
  onChange: (next: DocumentOptions) => void
}

export function DocumentOptionsSection({ options, onChange }: DocumentOptionsSectionProps) {
  const update = <K extends keyof DocumentOptions>(key: K, value: DocumentOptions[K]) => {
    onChange({ ...options, [key]: value })
  }

  return (
    <section className="panel format-panel">
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
            <option value="short">Jun 2024 – Aug 2025 (month first)</option>
            <option value="numeric">06/2024 – 08/2025</option>
            <option value="iso">2024-06 – 2025-08</option>
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
    </section>
  )
}
