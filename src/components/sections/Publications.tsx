import { IconFileText, IconPlus, IconX } from '../ui/Icons'
import type { PublicationItem } from '../../types/resume'

interface PublicationsSectionProps {
  publications: PublicationItem[]
  onChange: (next: PublicationItem[]) => void
}

const empty: PublicationItem = {
  title: '',
  venue: '',
  date: '',
  url: '',
}

export function PublicationsSection({ publications, onChange }: PublicationsSectionProps) {
  const items = publications.length > 0 ? publications : [empty]

  const add = () => onChange([...items, { ...empty }])
  const remove = (index: number) => {
    const next = items.filter((_, itemIndex) => itemIndex !== index)
    onChange(next.length > 0 ? next : [{ ...empty }])
  }
  const update = (index: number, key: keyof PublicationItem, value: string) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)))
  }

  return (
    <section className="panel">
      <div className="section-head">
        <IconFileText size={16} />
        <span className="section-title">Publications</span>
        <span className="count-badge">{items.length}</span>
        <button type="button" className="ghost-add" title="Add publication" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {items.map((item, index) => (
          <div className="card" key={`pub-${index}`}>
            <button type="button" className="card-close" title="Remove" onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Title <input value={item.title} onChange={(e) => update(index, 'title', e.target.value)} /></label>
              <label>Venue / Journal <input value={item.venue} onChange={(e) => update(index, 'venue', e.target.value)} /></label>
              <label>Date <input value={item.date} onChange={(e) => update(index, 'date', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>URL <input value={item.url} onChange={(e) => update(index, 'url', e.target.value)} placeholder="https://..." /></label>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
