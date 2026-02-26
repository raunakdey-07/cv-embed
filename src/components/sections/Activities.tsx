import { IconFlag, IconPlus, IconX } from '../ui/Icons'
import type { ActivityItem } from '../../types/resume'

interface ActivitiesSectionProps {
  activities: ActivityItem[]
  onChange: (next: ActivityItem[]) => void
}

const empty: ActivityItem = { role: '', organization: '', location: '', startDate: '', endDate: '', referenceUrl: '' }

export function ActivitiesSection({ activities, onChange }: ActivitiesSectionProps) {
  const items = activities.length > 0 ? activities : [empty]

  const add = () => onChange([...items, { ...empty }])
  const remove = (i: number) => { const n = items.filter((_, j) => j !== i); onChange(n.length > 0 ? n : [{ ...empty }]) }
  const update = (i: number, k: keyof ActivityItem, v: string) => onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x))

  return (
    <section className="panel">
      <div className="section-head">
        <IconFlag size={16} />
        <span className="section-title">Activities</span>
        <span className="count-badge">{items.length}</span>
        <button type="button" className="ghost-add" title="Add activity" onClick={add}><IconPlus size={14} /></button>
      </div>
      <div className="field-stack">
        {items.map((item, i) => (
          <div className="card" key={`act-${i}`}>
            <button type="button" className="card-close" title="Remove" onClick={() => remove(i)}><IconX size={12} /></button>
            <div className="field-grid">
              <label>Role <input value={item.role} onChange={(e) => update(i, 'role', e.target.value)} /></label>
              <label>Organization <input value={item.organization} onChange={(e) => update(i, 'organization', e.target.value)} /></label>
              <label>Start <input value={item.startDate} onChange={(e) => update(i, 'startDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>End <input value={item.endDate} onChange={(e) => update(i, 'endDate', e.target.value)} placeholder="YYYY-MM or MMM YYYY" /></label>
              <label>Location <input value={item.location} onChange={(e) => update(i, 'location', e.target.value)} /></label>
              <label>Reference URL <input value={item.referenceUrl} onChange={(e) => update(i, 'referenceUrl', e.target.value)} placeholder="https://..." /></label>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
