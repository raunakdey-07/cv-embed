import { IconGraduationCap, IconPlus, IconX } from '../ui/Icons'
import type { EducationItem } from '../../types/resume'

interface EducationSectionProps {
  education: EducationItem[]
  onChange: (next: EducationItem[]) => void
}

const emptyEducation: EducationItem = { institution: '', degree: '', field: '', cgpa: '', startDate: '', endDate: '', location: '' }

export function EducationSection({ education, onChange }: EducationSectionProps) {
  const add = () => onChange([...education, { ...emptyEducation }])
  const remove = (index: number) => onChange(education.filter((_, itemIndex) => itemIndex !== index))
  const update = (index: number, key: keyof EducationItem, value: string) => onChange(education.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))

  return (
    <section className="panel">
      <div className="section-head">
        <IconGraduationCap size={16} />
        <h2 className="section-title">Education</h2>
        <span className="count-badge">{education.length}</span>
        <button type="button" className="ghost-add" title="Add education" aria-label="Add education" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {education.length === 0 ? <p className="section-empty">No education added yet.</p> : education.map((item, index) => (
          <div className="card" key={`edu-${index}`}>
            <button type="button" className="card-close" title="Remove education" aria-label={`Remove education ${index + 1}`} onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Institution <input name={`education-${index}-institution`} value={item.institution} onChange={(event) => update(index, 'institution', event.target.value)} /></label>
              <label>Degree <input name={`education-${index}-degree`} value={item.degree} onChange={(event) => update(index, 'degree', event.target.value)} /></label>
              <label>Field <input name={`education-${index}-field`} value={item.field} onChange={(event) => update(index, 'field', event.target.value)} /></label>
              <label>CGPA <input name={`education-${index}-cgpa`} value={item.cgpa} onChange={(event) => update(index, 'cgpa', event.target.value)} /></label>
              <label>Start <input name={`education-${index}-start`} value={item.startDate} onChange={(event) => update(index, 'startDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input name={`education-${index}-end`} value={item.endDate} onChange={(event) => update(index, 'endDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
            </div>
            <label>Location <input name={`education-${index}-location`} value={item.location} onChange={(event) => update(index, 'location', event.target.value)} /></label>
          </div>
        ))}
      </div>
    </section>
  )
}
