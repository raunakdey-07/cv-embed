import { IconFileText, IconPlus, IconX } from '../ui/Icons'
import type { PublicationItem } from '../../types/resume'

interface PublicationsSectionProps {
  publications: PublicationItem[]
  onChange: (next: PublicationItem[]) => void
}

const empty: PublicationItem = { title: '', venue: '', date: '', url: '' }

export function PublicationsSection({ publications, onChange }: PublicationsSectionProps) {
  const add = () => onChange([...publications, { ...empty }])
  const remove = (index: number) => onChange(publications.filter((_, itemIndex) => itemIndex !== index))
  const update = (index: number, key: keyof PublicationItem, value: string) => onChange(publications.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))

  return (
    <section className="panel">
      <div className="section-head">
        <IconFileText size={16} />
        <h2 className="section-title">Publications</h2>
        <span className="count-badge">{publications.length}</span>
        <button type="button" className="ghost-add" title="Add publication" aria-label="Add publication" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {publications.length === 0 ? <p className="section-empty">No publications added yet.</p> : publications.map((item, index) => (
          <div className="card" key={`pub-${index}`}>
            <button type="button" className="card-close" title="Remove publication" aria-label={`Remove publication ${index + 1}`} onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Title <input name={`publication-${index}-title`} value={item.title} onChange={(event) => update(index, 'title', event.target.value)} /></label>
              <label>Venue / Journal <input name={`publication-${index}-venue`} value={item.venue} onChange={(event) => update(index, 'venue', event.target.value)} /></label>
              <label>Date <input name={`publication-${index}-date`} value={item.date} onChange={(event) => update(index, 'date', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>URL <input name={`publication-${index}-url`} type="url" value={item.url} onChange={(event) => update(index, 'url', event.target.value)} placeholder="https://..." /></label>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
