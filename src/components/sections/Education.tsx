import { IconGraduationCap, IconPlus, IconX } from '../ui/Icons'
import type { EducationItem } from '../../types/resume'

interface EducationSectionProps {
  education: EducationItem[]
  onChange: (next: EducationItem[]) => void
}

const emptyEducation: EducationItem = { institution: '', degree: '', field: '', cgpa: '', startDate: '', endDate: '', location: '' }

export function EducationSection({ education, onChange }: EducationSectionProps) {
  const items = education.length > 0 ? education : [emptyEducation]

  const add = () => onChange([...items, { ...emptyEducation }])
  const remove = (i: number) => { const n = items.filter((_, j) => j !== i); onChange(n.length > 0 ? n : [{ ...emptyEducation }]) }
  const update = (i: number, k: keyof EducationItem, v: string) => onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x))

  return (
    <section className="panel">
      <div className="section-head">
        <IconGraduationCap size={16} />
        <span className="section-title">Education</span>
        <span className="count-badge">{items.length}</span>
        <button type="button" className="ghost-add" title="Add education" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {items.map((item, i) => (
          <div className="card" key={`edu-${i}`}>
            <button type="button" className="card-close" title="Remove" onClick={() => remove(i)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Institution <input value={item.institution} onChange={(e) => update(i, 'institution', e.target.value)} /></label>
              <label>Degree <input value={item.degree} onChange={(e) => update(i, 'degree', e.target.value)} /></label>
              <label>Field <input value={item.field} onChange={(e) => update(i, 'field', e.target.value)} /></label>
              <label>CGPA <input value={item.cgpa} onChange={(e) => update(i, 'cgpa', e.target.value)} /></label>
              <label>Start <input value={item.startDate} onChange={(e) => update(i, 'startDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input value={item.endDate} onChange={(e) => update(i, 'endDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
            </div>
            <label>Location <input value={item.location} onChange={(e) => update(i, 'location', e.target.value)} /></label>
          </div>
        ))}
      </div>
    </section>
  )
}
