import { IconFlag, IconPlus, IconX } from '../ui/Icons'
import type { VolunteeringItem } from '../../types/resume'

interface VolunteeringSectionProps {
  volunteering: VolunteeringItem[]
  onChange: (next: VolunteeringItem[]) => void
}

const empty: VolunteeringItem = { role: '', organization: '', location: '', startDate: '', endDate: '', bullets: [''] }

export function VolunteeringSection({ volunteering, onChange }: VolunteeringSectionProps) {
  const add = () => onChange([...volunteering, { ...empty, bullets: [''] }])
  const remove = (index: number) => onChange(volunteering.filter((_, itemIndex) => itemIndex !== index))
  const update = (index: number, key: keyof Omit<VolunteeringItem, 'bullets'>, value: string) => onChange(volunteering.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  const updateBullet = (itemIndex: number, bulletIndex: number, value: string) => onChange(volunteering.map((item, index) => {
    if (index !== itemIndex) return item
    const bullets = [...item.bullets]
    bullets[bulletIndex] = value
    return { ...item, bullets }
  }))
  const addBullet = (itemIndex: number) => onChange(volunteering.map((item, index) => index === itemIndex && item.bullets.length < 4 ? { ...item, bullets: [...item.bullets, ''] } : item))
  const removeBullet = (itemIndex: number, bulletIndex: number) => onChange(volunteering.map((item, index) => {
    if (index !== itemIndex) return item
    const bullets = item.bullets.filter((_, bulletIndexValue) => bulletIndexValue !== bulletIndex)
    return { ...item, bullets: bullets.length > 0 ? bullets : [''] }
  }))

  return (
    <section className="panel">
      <div className="section-head">
        <IconFlag size={16} />
        <h2 className="section-title">Volunteering</h2>
        <span className="count-badge">{volunteering.length}</span>
        <button type="button" className="ghost-add" title="Add volunteering" aria-label="Add volunteering" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {volunteering.length === 0 ? <p className="section-empty">No volunteering added yet.</p> : volunteering.map((item, index) => (
          <div className="card" key={`vol-${index}`}>
            <button type="button" className="card-close" title="Remove volunteering" aria-label={`Remove volunteering ${index + 1}`} onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Role <input name={`volunteering-${index}-role`} value={item.role} onChange={(event) => update(index, 'role', event.target.value)} /></label>
              <label>Organization <input name={`volunteering-${index}-organization`} value={item.organization} onChange={(event) => update(index, 'organization', event.target.value)} /></label>
              <label>Start <input name={`volunteering-${index}-start`} value={item.startDate} onChange={(event) => update(index, 'startDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input name={`volunteering-${index}-end`} value={item.endDate} onChange={(event) => update(index, 'endDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>Location <input name={`volunteering-${index}-location`} value={item.location} onChange={(event) => update(index, 'location', event.target.value)} /></label>
            </div>
            <div className="bullet-group">
              {item.bullets.map((bullet, bulletIndex) => (
                <div className="bullet-row" key={`vol-${index}-b-${bulletIndex}`}>
                  <textarea aria-label={`Volunteering ${index + 1} bullet ${bulletIndex + 1}`} name={`volunteering-${index}-bullet-${bulletIndex}`} rows={2} value={bullet} onChange={(event) => updateBullet(index, bulletIndex, event.target.value)} placeholder={`Bullet ${bulletIndex + 1}`} />
                  <button type="button" className="bullet-dismiss" title="Remove bullet" aria-label={`Remove volunteering ${index + 1} bullet ${bulletIndex + 1}`} onClick={() => removeBullet(index, bulletIndex)}><IconX size={10} /></button>
                </div>
              ))}
              {item.bullets.length < 4 ? <button type="button" className="add-inline" onClick={() => addBullet(index)}><IconPlus size={12} /> bullet</button> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
