import { IconBriefcase, IconPlus, IconX } from '../ui/Icons'
import type { ExperienceItem } from '../../types/resume'

interface ExperienceSectionProps {
  experience: ExperienceItem[]
  onChange: (next: ExperienceItem[]) => void
}

const empty: ExperienceItem = { company: '', role: '', location: '', startDate: '', endDate: '', bullets: [''] }

export function ExperienceSection({ experience, onChange }: ExperienceSectionProps) {
  const items = experience.length > 0 ? experience : [empty]

  const add = () => onChange([...items, { ...empty, bullets: [''] }])
  const remove = (i: number) => { const n = items.filter((_, j) => j !== i); onChange(n.length > 0 ? n : [{ ...empty, bullets: [''] }]) }
  const update = (i: number, k: keyof Omit<ExperienceItem, 'bullets'>, v: string) => onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x))

  const updateBullet = (ei: number, bi: number, v: string) => {
    onChange(items.map((x, j) => {
      if (j !== ei) return x
      const bullets = [...x.bullets]; bullets[bi] = v
      return { ...x, bullets }
    }))
  }
  const addBullet = (ei: number) => {
    onChange(items.map((x, j) => j !== ei || x.bullets.length >= 4 ? x : { ...x, bullets: [...x.bullets, ''] }))
  }
  const removeBullet = (ei: number, bi: number) => {
    onChange(items.map((x, j) => {
      if (j !== ei) return x
      const bullets = x.bullets.filter((_, k) => k !== bi)
      return { ...x, bullets: bullets.length > 0 ? bullets : [''] }
    }))
  }

  return (
    <section className="panel">
      <div className="section-head">
        <IconBriefcase size={16} />
        <span className="section-title">Experience</span>
        <span className="count-badge">{items.length}</span>
        <button type="button" className="ghost-add" title="Add experience" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {items.map((item, i) => (
          <div className="card" key={`exp-${i}`}>
            <button type="button" className="card-close" title="Remove" onClick={() => remove(i)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Company <input value={item.company} onChange={(e) => update(i, 'company', e.target.value)} /></label>
              <label>Role <input value={item.role} onChange={(e) => update(i, 'role', e.target.value)} /></label>
              <label>Start <input value={item.startDate} onChange={(e) => update(i, 'startDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input value={item.endDate} onChange={(e) => update(i, 'endDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>Location <input value={item.location} onChange={(e) => update(i, 'location', e.target.value)} /></label>
            </div>
            <div className="bullet-group">
              {item.bullets.map((b, bi) => (
                <div className="bullet-row" key={`exp-${i}-b-${bi}`}>
                  <textarea rows={2} value={b} onChange={(e) => updateBullet(i, bi, e.target.value)} placeholder={`Bullet ${bi + 1}`} />
                  <button type="button" className="bullet-dismiss" title="Remove bullet" onClick={() => removeBullet(i, bi)}><IconX size={10} /></button>
                </div>
              ))}
              {item.bullets.length < 4 ? (
                <button type="button" className="add-inline" onClick={() => addBullet(i)}>
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
