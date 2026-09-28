import { useState } from 'react'
import { IconCode, IconPlus, IconX } from '../ui/Icons'
import { parseTechStack } from '../../lib/utils'
import type { ProjectItem } from '../../types/resume'

interface ProjectsSectionProps {
  projects: ProjectItem[]
  onChange: (next: ProjectItem[]) => void
}

const empty: ProjectItem = { title: '', projectLink: '', repoLink: '', techStack: [], startDate: '', endDate: '', bullets: [''] }

/**
 * The field holds a raw string while the user is typing and commits the parsed
 * list to the resume. Driving the input from the parsed array instead would
 * rewrite the value on every keystroke, which swallows the comma and the space
 * that follow it: "Go, Postgres" collapses to "GoPostgres".
 */
function TechStackInput({ value, onCommit, name, placeholder }: { value: string[]; onCommit: (next: string[]) => void; name: string; placeholder: string }) {
  const [draft, setDraft] = useState(() => value.join(', '))
  const [committed, setCommitted] = useState(() => value.join(', '))

  // Adopt a list that changed elsewhere (import, reset) without disturbing what
  // the user is currently typing.
  const incoming = value.join(', ')
  if (incoming !== committed) {
    setCommitted(incoming)
    if (draft === committed) setDraft(incoming)
  }

  const edit = (raw: string) => {
    const next = parseTechStack(raw)
    setDraft(raw)
    setCommitted(next.join(', '))
    onCommit(next)
  }

  return (
    <input
      name={name}
      value={draft}
      onChange={(event) => edit(event.target.value)}
      onBlur={() => setDraft(committed)}
      placeholder={placeholder}
    />
  )
}

export function ProjectsSection({ projects, onChange }: ProjectsSectionProps) {
  const add = () => onChange([...projects, { ...empty, bullets: [''] }])
  const remove = (index: number) => onChange(projects.filter((_, itemIndex) => itemIndex !== index))
  const update = (index: number, key: keyof Omit<ProjectItem, 'bullets' | 'techStack'>, value: string) => onChange(projects.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  const updateTech = (index: number, techStack: string[]) => {
    onChange(projects.map((item, itemIndex) => itemIndex === index ? { ...item, techStack } : item))
  }

  const updateBullet = (projectIndex: number, bulletIndex: number, value: string) => {
    onChange(projects.map((item, itemIndex) => {
      if (itemIndex !== projectIndex) return item
      const bullets = [...item.bullets]
      bullets[bulletIndex] = value
      return { ...item, bullets }
    }))
  }
  const addBullet = (projectIndex: number) => {
    onChange(projects.map((item, itemIndex) => itemIndex === projectIndex && item.bullets.length < 3 ? { ...item, bullets: [...item.bullets, ''] } : item))
  }
  const removeBullet = (projectIndex: number, bulletIndex: number) => {
    onChange(projects.map((item, itemIndex) => {
      if (itemIndex !== projectIndex) return item
      const bullets = item.bullets.filter((_, index) => index !== bulletIndex)
      return { ...item, bullets: bullets.length > 0 ? bullets : [''] }
    }))
  }

  return (
    <section className="panel">
      <div className="section-head">
        <IconCode size={16} />
        <h2 className="section-title">Projects</h2>
        <span className="count-badge">{projects.length}</span>
        <button type="button" className="ghost-add" title="Add project" aria-label="Add project" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {projects.length === 0 ? <p className="section-empty">No projects added yet.</p> : projects.map((item, index) => (
          <div className="card" key={`proj-${index}`}>
            <button type="button" className="card-close" title="Remove project" aria-label={`Remove project ${index + 1}`} onClick={() => remove(index)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Title <input name={`project-${index}-title`} value={item.title} onChange={(event) => update(index, 'title', event.target.value)} /></label>
              <label>Tech Stack <TechStackInput name={`project-${index}-tech`} value={item.techStack} onCommit={(techStack) => updateTech(index, techStack)} placeholder="React, Node, ..." /></label>
              <label>Project Link <input name={`project-${index}-link`} type="url" value={item.projectLink} onChange={(event) => update(index, 'projectLink', event.target.value)} placeholder="https://..." /></label>
              <label>Repo Link <input name={`project-${index}-repo`} type="url" value={item.repoLink} onChange={(event) => update(index, 'repoLink', event.target.value)} placeholder="https://github.com/..." /></label>
              <label>Start <input name={`project-${index}-start`} value={item.startDate} onChange={(event) => update(index, 'startDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input name={`project-${index}-end`} value={item.endDate} onChange={(event) => update(index, 'endDate', event.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
            </div>
            <div className="bullet-group">
              {item.bullets.map((bullet, bulletIndex) => (
                <div className="bullet-row" key={`proj-${index}-b-${bulletIndex}`}>
                  <textarea aria-label={`Project ${index + 1} bullet ${bulletIndex + 1}`} name={`project-${index}-bullet-${bulletIndex}`} rows={2} value={bullet} onChange={(event) => updateBullet(index, bulletIndex, event.target.value)} placeholder={`Bullet ${bulletIndex + 1}`} />
                  <button type="button" className="bullet-dismiss" title="Remove bullet" aria-label={`Remove project ${index + 1} bullet ${bulletIndex + 1}`} onClick={() => removeBullet(index, bulletIndex)}><IconX size={10} /></button>
                </div>
              ))}
              {item.bullets.length < 3 ? (
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
