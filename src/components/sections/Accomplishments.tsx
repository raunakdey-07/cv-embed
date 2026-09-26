import { IconPlus, IconTrophy, IconX } from '../ui/Icons'
import type { AccomplishmentItem } from '../../types/resume'

interface AccomplishmentsSectionProps {
  accomplishments: AccomplishmentItem[]
  onChange: (next: AccomplishmentItem[]) => void
}

const empty: AccomplishmentItem = { title: '', organization: '', location: '', startDate: '', endDate: '', bullets: [''] }

export function AccomplishmentsSection({ accomplishments, onChange }: AccomplishmentsSectionProps) {
  const add = () => onChange([...accomplishments, { ...empty, bullets: [''] }])
  const remove = (index: number) => onChange(accomplishments.filter((_, itemIndex) => itemIndex !== index))
  const update = (index: number, key: keyof Omit<AccomplishmentItem, 'bullets'>, value: string) => onChange(accomplishments.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  const updateBullet = (itemIndex: number, bulletIndex: number, value: string) => onChange(accomplishments.map((item, index) => {
    if (index !== itemIndex) return item
    const bullets = [...item.bullets]
    bullets[bulletIndex] = value
    return { ...item, bullets }
  }))
  const addBullet = (itemIndex: number) => onChange(accomplishments.map((item, index) => index === itemIndex && item.bullets.length < 3 ? { ...item, bullets: [...item.bullets, ''] } : item))
  const removeBullet = (itemIndex: number, bulletIndex: number) => onChange(accomplishments.map((item, index) => {
    if (index !== itemIndex) return item
    const bullets = item.bullets.filter((_, index) => index !== bulletIndex)
    return { ...item, bullets: bullets.length > 0 ? bullets : [''] }
  }))

  return (
    <section className="panel">
      <div className="section-head">
        <IconTrophy size={16} />
        <h2 className="section-title">Accomplishments</h2>
        <span className="count-badge">{accomplishments.length}</span>
        <button type="button" className="ghost-add" title="Add accomplishment" aria-label="Add accomplishment" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {accomplishments.length === 0 ? <p className="section-empty">No accomplishments added yet.</p> : accomplishments.map((item, index) => (
          <div className="card" key={`acc-${index}`}>
            <button type="button" className="card-close" title="Remove accomplishment" aria-label={`Remove accomplishment ${index + 1}`} onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Title <input name={`accomplishment-${index}-title`} value={item.title} onChange={(event) => update(index, 'title', event.target.value)} /></label>
              <label>Organization <input name={`accomplishment-${index}-organization`} value={item.organization} onChange={(event) => update(index, 'organization', event.target.value)} /></label>
              <label>Start <input name={`accomplishment-${index}-start`} value={item.startDate} onChange={(event) => update(index, 'startDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input name={`accomplishment-${index}-end`} value={item.endDate} onChange={(event) => update(index, 'endDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>Location <input name={`accomplishment-${index}-location`} value={item.location} onChange={(event) => update(index, 'location', event.target.value)} /></label>
            </div>
            <div className="bullet-group">
              {item.bullets.map((bullet, bulletIndex) => (
                <div className="bullet-row" key={`acc-${index}-b-${bulletIndex}`}>
                  <textarea aria-label={`Accomplishment ${index + 1} bullet ${bulletIndex + 1}`} name={`accomplishment-${index}-bullet-${bulletIndex}`} rows={2} value={bullet} onChange={(event) => updateBullet(index, bulletIndex, event.target.value)} placeholder={`Bullet ${bulletIndex + 1}`} />
                  <button type="button" className="bullet-dismiss" title="Remove bullet" aria-label={`Remove accomplishment ${index + 1} bullet ${bulletIndex + 1}`} onClick={() => removeBullet(index, bulletIndex)}><IconX size={10} /></button>
                </div>
              ))}
              {item.bullets.length < 3 ? <button type="button" className="add-inline" onClick={() => addBullet(index)}><IconPlus size={12} /> bullet</button> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
