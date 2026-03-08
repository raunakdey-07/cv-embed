import { IconFlag, IconPlus, IconX } from '../ui/Icons'
import type { VolunteeringItem } from '../../types/resume'

interface VolunteeringSectionProps {
  volunteering: VolunteeringItem[]
  onChange: (next: VolunteeringItem[]) => void
}

const empty: VolunteeringItem = {
  role: '',
  organization: '',
  location: '',
  startDate: '',
  endDate: '',
  bullets: [''],
}

export function VolunteeringSection({ volunteering, onChange }: VolunteeringSectionProps) {
  const items = volunteering.length > 0 ? volunteering : [empty]

  const add = () => onChange([...items, { ...empty, bullets: [''] }])
  const remove = (index: number) => {
    const next = items.filter((_, itemIndex) => itemIndex !== index)
    onChange(next.length > 0 ? next : [{ ...empty, bullets: [''] }])
  }
  const update = (index: number, key: keyof Omit<VolunteeringItem, 'bullets'>, value: string) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)))
  }

  const updateBullet = (sectionIndex: number, bulletIndex: number, value: string) => {
    onChange(items.map((item, itemIndex) => {
      if (itemIndex !== sectionIndex) {
        return item
      }
      const bullets = [...item.bullets]
      bullets[bulletIndex] = value
      return { ...item, bullets }
    }))
  }

  const addBullet = (sectionIndex: number) => {
    onChange(items.map((item, itemIndex) => {
      if (itemIndex !== sectionIndex || item.bullets.length >= 4) {
        return item
      }
      return { ...item, bullets: [...item.bullets, ''] }
    }))
  }

  const removeBullet = (sectionIndex: number, bulletIndex: number) => {
    onChange(items.map((item, itemIndex) => {
      if (itemIndex !== sectionIndex) {
        return item
      }
      const bullets = item.bullets.filter((_, index) => index !== bulletIndex)
      return { ...item, bullets: bullets.length > 0 ? bullets : [''] }
    }))
  }

  return (
    <section className="panel">
      <div className="section-head">
        <IconFlag size={16} />
        <span className="section-title">Volunteering</span>
        <span className="count-badge">{items.length}</span>
        <button type="button" className="ghost-add" title="Add volunteering" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {items.map((item, index) => (
          <div className="card" key={`vol-${index}`}>
            <button type="button" className="card-close" title="Remove" onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Role <input value={item.role} onChange={(e) => update(index, 'role', e.target.value)} /></label>
              <label>Organization <input value={item.organization} onChange={(e) => update(index, 'organization', e.target.value)} /></label>
              <label>Start <input value={item.startDate} onChange={(e) => update(index, 'startDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input value={item.endDate} onChange={(e) => update(index, 'endDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>Location <input value={item.location} onChange={(e) => update(index, 'location', e.target.value)} /></label>
            </div>
            <div className="bullet-group">
              {item.bullets.map((bullet, bulletIndex) => (
                <div className="bullet-row" key={`vol-${index}-b-${bulletIndex}`}>
                  <textarea
                    rows={2}
                    value={bullet}
                    onChange={(e) => updateBullet(index, bulletIndex, e.target.value)}
                    placeholder={`Bullet ${bulletIndex + 1}`}
                  />
                  <button type="button" className="bullet-dismiss" title="Remove bullet" onClick={() => removeBullet(index, bulletIndex)}>
                    <IconX size={10} />
                  </button>
                </div>
              ))}
              {item.bullets.length < 4 ? (
                <button type="button" className="add-inline" onClick={() => addBullet(index)}>
                  <IconPlus size={12} /> bullet
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
