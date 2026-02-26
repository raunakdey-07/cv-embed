import { useState } from 'react'
import { IconPlus, IconZap } from '../ui/Icons'
import type { Skills } from '../../types/resume'

interface SkillsSectionProps {
  skills: Skills
  onChange: (next: Skills) => void
}

function SkillCategoryEditor({ title, values, onChange }: { title: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const s = draft.trim()
    if (!s) return
    onChange([...values, s])
    setDraft('')
  }

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); add() } }

  return (
    <div className="card skill-category">
      <h4 className="skill-cat-title">{title}</h4>
      <div className="skill-input-row">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={`Add ${title.toLowerCase()}`} />
        <button type="button" className="ghost-add" title="Add" onClick={add}><IconPlus size={12} /></button>
      </div>
      {values.length > 0 ? (
        <div className="chip-list">
          {values.map((s, i) => (
            <span className="chip" key={`${title}-${i}`}>
              {s}
              <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function SkillsSection({ skills, onChange }: SkillsSectionProps) {
  const total = skills.languages.length + skills.frameworks.length + skills.tools.length + skills.other.length

  return (
    <section className="panel">
      <div className="section-head">
        <IconZap size={16} />
        <span className="section-title">Skills</span>
        <span className="count-badge">{total}</span>
      </div>
      <div className="field-stack">
        <SkillCategoryEditor title="Languages" values={skills.languages} onChange={(languages) => onChange({ ...skills, languages })} />
        <SkillCategoryEditor title="Frameworks" values={skills.frameworks} onChange={(frameworks) => onChange({ ...skills, frameworks })} />
        <SkillCategoryEditor title="Tools" values={skills.tools} onChange={(tools) => onChange({ ...skills, tools })} />
        <SkillCategoryEditor title="Other" values={skills.other} onChange={(other) => onChange({ ...skills, other })} />
      </div>
    </section>
  )
}
