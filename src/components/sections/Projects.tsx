import { IconCode, IconPlus, IconX } from '../ui/Icons'
import type { ProjectItem } from '../../types/resume'

interface ProjectsSectionProps {
  projects: ProjectItem[]
  onChange: (next: ProjectItem[]) => void
}

const empty: ProjectItem = { title: '', projectLink: '', repoLink: '', techStack: [], startDate: '', endDate: '', bullets: [''] }

export function ProjectsSection({ projects, onChange }: ProjectsSectionProps) {
  const items = projects.length > 0 ? projects : [empty]

  const add = () => onChange([...items, { ...empty, bullets: [''] }])
  const remove = (i: number) => { const n = items.filter((_, j) => j !== i); onChange(n.length > 0 ? n : [{ ...empty, bullets: [''] }]) }
  const update = (i: number, k: keyof Omit<ProjectItem, 'bullets' | 'techStack'>, v: string) => onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const updateTech = (i: number, v: string) => {
    const techStack = v.split(',').map(s => s.trim()).filter(Boolean)
    onChange(items.map((x, j) => j === i ? { ...x, techStack } : x))
  }

  const updateBullet = (pi: number, bi: number, v: string) => {
    onChange(items.map((x, j) => {
      if (j !== pi) return x
      const bullets = [...x.bullets]; bullets[bi] = v
      return { ...x, bullets }
    }))
  }
  const addBullet = (pi: number) => {
    onChange(items.map((x, j) => j !== pi || x.bullets.length >= 3 ? x : { ...x, bullets: [...x.bullets, ''] }))
  }
  const removeBullet = (pi: number, bi: number) => {
    onChange(items.map((x, j) => {
      if (j !== pi) return x
      const bullets = x.bullets.filter((_, k) => k !== bi)
      return { ...x, bullets: bullets.length > 0 ? bullets : [''] }
    }))
  }

  return (
    <section className="panel">
      <div className="section-head">
        <IconCode size={16} />
        <span className="section-title">Projects</span>
        <span className="count-badge">{items.length}</span>
        <button type="button" className="ghost-add" title="Add project" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {items.map((item, i) => (
          <div className="card" key={`proj-${i}`}>
            <button type="button" className="card-close" title="Remove" onClick={() => remove(i)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Title <input value={item.title} onChange={(e) => update(i, 'title', e.target.value)} /></label>
              <label>Tech Stack <input value={item.techStack.join(', ')} onChange={(e) => updateTech(i, e.target.value)} placeholder="React, Node, ..." /></label>
              <label>Project Link <input value={item.projectLink} onChange={(e) => update(i, 'projectLink', e.target.value)} placeholder="https://..." /></label>
              <label>Repo Link <input value={item.repoLink} onChange={(e) => update(i, 'repoLink', e.target.value)} placeholder="https://github.com/..." /></label>
              <label>Start <input value={item.startDate} onChange={(e) => update(i, 'startDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input value={item.endDate} onChange={(e) => update(i, 'endDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
            </div>
            <div className="bullet-group">
              {item.bullets.map((b, bi) => (
                <div className="bullet-row" key={`proj-${i}-b-${bi}`}>
                  <textarea rows={2} value={b} onChange={(e) => updateBullet(i, bi, e.target.value)} placeholder={`Bullet ${bi + 1}`} />
                  <button type="button" className="bullet-dismiss" title="Remove bullet" onClick={() => removeBullet(i, bi)}><IconX size={10} /></button>
                </div>
              ))}
              {item.bullets.length < 3 ? (
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
