import { IconFileText } from '../ui/Icons'

interface SummarySectionProps {
  summary: string
  onChange: (summary: string) => void
}

export function SummarySection({ summary, onChange }: SummarySectionProps) {
  return (
    <section className="panel">
      <div className="section-head">
        <IconFileText size={16} />
        <h2 className="section-title">Summary</h2>
      </div>
      <label>
        Professional summary
        <textarea
          name="summary"
          rows={4}
          value={summary}
          onChange={(event) => onChange(event.target.value)}
          placeholder="2-3 lines on your experience, focus, and impact"
        />
      </label>
    </section>
  )
}
