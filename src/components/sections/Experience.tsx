import { IconBriefcase, IconPlus, IconX } from '../ui/Icons'
import type { ExperienceItem } from '../../types/resume'

interface ExperienceSectionProps {
  experience: ExperienceItem[]
  onChange: (next: ExperienceItem[]) => void
}

const empty: ExperienceItem = { company: '', role: '', location: '', startDate: '', endDate: '', bullets: [''] }

export function ExperienceSection({ experience, onChange }: ExperienceSectionProps) {
  const add = () => onChange([...experience, { ...empty, bullets: [''] }])
  const remove = (index: number) => onChange(experience.filter((_, itemIndex) => itemIndex !== index))
  const update = (index: number, key: keyof Omit<ExperienceItem, 'bullets'>, value: string) => onChange(experience.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))

  const updateBullet = (experienceIndex: number, bulletIndex: number, value: string) => {
    onChange(experience.map((item, itemIndex) => {
      if (itemIndex !== experienceIndex) return item
      const bullets = [...item.bullets]
      bullets[bulletIndex] = value
      return { ...item, bullets }
    }))
  }
  const addBullet = (experienceIndex: number) => {
    onChange(experience.map((item, itemIndex) => itemIndex === experienceIndex && item.bullets.length < 4 ? { ...item, bullets: [...item.bullets, ''] } : item))
  }
  const removeBullet = (experienceIndex: number, bulletIndex: number) => {
    onChange(experience.map((item, itemIndex) => {
      if (itemIndex !== experienceIndex) return item
      const bullets = item.bullets.filter((_, index) => index !== bulletIndex)
      return { ...item, bullets: bullets.length > 0 ? bullets : [''] }
    }))
  }

  return (
    <section className="panel">
      <div className="section-head">
        <IconBriefcase size={16} />
        <h2 className="section-title">Experience</h2>
        <span className="count-badge">{experience.length}</span>
        <button type="button" className="ghost-add" title="Add experience" aria-label="Add experience" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {experience.length === 0 ? <p className="section-empty">No experience added yet.</p> : experience.map((item, index) => (
          <div className="card" key={`exp-${index}`}>
            <button type="button" className="card-close" title="Remove experience" aria-label={`Remove experience ${index + 1}`} onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Company <input name={`experience-${index}-company`} value={item.company} onChange={(event) => update(index, 'company', event.target.value)} /></label>
              <label>Role <input name={`experience-${index}-role`} value={item.role} onChange={(event) => update(index, 'role', event.target.value)} /></label>
              <label>Start <input name={`experience-${index}-start`} value={item.startDate} onChange={(event) => update(index, 'startDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input name={`experience-${index}-end`} value={item.endDate} onChange={(event) => update(index, 'endDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>Location <input name={`experience-${index}-location`} value={item.location} onChange={(event) => update(index, 'location', event.target.value)} /></label>
            </div>
            <div className="bullet-group">
              {item.bullets.map((bullet, bulletIndex) => (
                <div className="bullet-row" key={`exp-${index}-b-${bulletIndex}`}>
                  <textarea aria-label={`Experience ${index + 1} bullet ${bulletIndex + 1}`} name={`experience-${index}-bullet-${bulletIndex}`} rows={2} value={bullet} onChange={(event) => updateBullet(index, bulletIndex, event.target.value)} placeholder={`Bullet ${bulletIndex + 1}`} />
                  <button type="button" className="bullet-dismiss" title="Remove bullet" aria-label={`Remove experience ${index + 1} bullet ${bulletIndex + 1}`} onClick={() => removeBullet(index, bulletIndex)}><IconX size={10} /></button>
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
